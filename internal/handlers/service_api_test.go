package handlers_test

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"

	"warehousecore/internal/handlers"
	"warehousecore/internal/middleware"
	"warehousecore/internal/repository"
)

// withErrorDB injects a sqlmock DB that returns a connection error on any
// query, simulating a database that is unavailable. This is preferred over
// setting repository.DB = nil because it avoids mutating global nil state
// that could race with concurrent package-level tests.
func withErrorDB(t *testing.T) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	mock.ExpectQuery(".*").WillReturnError(errors.New("connection refused"))
	origSQL := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		repository.DB = origSQL
		db.Close()
	})
}

// serviceRouter builds a minimal router that mirrors the service subrouter
// registered in main.go, but without any database so we can test auth and
// routing behaviour in isolation.
func serviceRouter() http.Handler {
	router := mux.NewRouter()
	service := router.PathPrefix("/api/v1/service").Subrouter()
	service.Use(middleware.APIKeyMiddleware)
	service.HandleFunc("/cables", handlers.GetAllCables).Methods("GET")
	service.HandleFunc("/cables/{id}", handlers.GetCable).Methods("GET")
	service.HandleFunc("/devices/{id}", handlers.GetDevice).Methods("GET")
	return router
}

// TestServiceAPI_MissingAPIKey verifies that all service endpoints return 401
// when no API key is supplied.
func TestServiceAPI_MissingAPIKey(t *testing.T) {
	router := serviceRouter()

	paths := []string{
		"/api/v1/service/cables",
		"/api/v1/service/cables/1",
		"/api/v1/service/devices/DEV001",
	}

	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if rr.Code != http.StatusUnauthorized {
				t.Errorf("path %s: expected 401 without API key, got %d", path, rr.Code)
			}
			if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("path %s: expected Content-Type application/json, got %q", path, ct)
			}
		})
	}
}

// TestServiceAPI_APIKey_DBUnavailable_Returns500 verifies that when a key is
// present but the database is unavailable, the middleware returns 500 (not a
// misleading 401 "invalid key"). Uses a sqlmock DB that returns a connection
// error to avoid mutating global nil state.
func TestServiceAPI_APIKey_DBUnavailable_Returns500(t *testing.T) {
	withErrorDB(t)
	router := serviceRouter()

	paths := []string{
		"/api/v1/service/cables",
		"/api/v1/service/cables/1",
		"/api/v1/service/devices/DEV001",
	}

	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("X-API-Key", "some-key")
			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if rr.Code != http.StatusInternalServerError {
				t.Errorf("path %s: expected 500 when DB unavailable with API key, got %d", path, rr.Code)
			}
			if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("path %s: expected Content-Type application/json, got %q", path, ct)
			}
		})
	}
}

// TestServiceAPI_Routes_NotFoundWithoutAuth checks that the service routes
// exist in the router and are not accidentally public (no API key → 401, not 404).
func TestServiceAPI_Routes_NotFoundWithoutAuth(t *testing.T) {
	router := serviceRouter()

	// A completely unknown path should still return 405/404, not 401.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/service/unknown-endpoint", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// gorilla/mux returns 405 Method Not Allowed or 404 Not Found for unknown
	// routes, not 401 – confirming the route does not exist without auth.
	if rr.Code == http.StatusUnauthorized {
		t.Error("unknown service path returned 401 – route should not exist")
	}
}

// TestServiceAPI_CableRoute_Exists verifies that the /service/cables/{id} route
// is registered correctly by confirming that a request without an API key returns
// 401 (auth check fires before the handler, confirming the route is wired up).
func TestServiceAPI_CableRoute_Exists(t *testing.T) {
	router := serviceRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/service/cables/not-a-number", nil)
	// No API key → should get 401, confirming route exists
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 (auth check before handler), got %d", rr.Code)
	}
}

// TestGetDevice_ResponseIncludesCableID exercises the GetDevice handler with a
// mocked SQL database and verifies that the JSON response includes the cable_id
// field when a cable is associated with the device.
func TestGetDevice_ResponseIncludesCableID(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to open sqlmock: %v", err)
	}
	defer db.Close()

	// Inject the mock DB into the repository.
	origSQL := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = origSQL })

	cableID := int64(42)

	// The GetDevice query selects many columns; we must match them in order.
	rows := sqlmock.NewRows([]string{
		"deviceID", "productID",
		"product_name", "product_description", "product_category", "subcategory",
		"manufacturer_name", "brand_name",
		"product_weight", "product_width", "product_height", "product_depth",
		"maintenance_interval", "power_consumption",
		"serialnumber", "rfid", "barcode", "qr_code",
		"status", "zone_id", "condition_rating", "usage_hours", "label_path",
		"purchase_date", "notes",
		"zone_name", "zone_code", "case_name", "job_number",
		"cable_id",
	}).AddRow(
		"DEV001", sql.NullInt64{Int64: 1, Valid: true},
		"Test Product", "A test device", "Audio", "",
		"Shure", "Shure",
		float64(0), float64(0), float64(0), float64(0),
		0, float64(0),
		sql.NullString{}, sql.NullString{}, sql.NullString{}, sql.NullString{},
		"in_storage", sql.NullInt64{}, float64(4.5), float64(10.0), sql.NullString{},
		sql.NullString{}, sql.NullString{},
		"Shelf A", "WDL-01", "", "",
		sql.NullInt64{Int64: cableID, Valid: true},
	)

	mock.ExpectQuery(`SELECT d\.deviceID`).WillReturnRows(rows)

	// Build a router that routes to GetDevice without any auth middleware.
	router := mux.NewRouter()
	router.HandleFunc("/devices/{id}", handlers.GetDevice).Methods("GET")

	req := httptest.NewRequest(http.MethodGet, "/devices/DEV001", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}

	var body map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	rawCableID, ok := body["cable_id"]
	if !ok {
		t.Fatal("expected cable_id field in GetDevice response, but it was absent")
	}
	if rawCableID != float64(cableID) {
		t.Errorf("expected cable_id=%d, got %v", cableID, rawCableID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled sqlmock expectations: %v", err)
	}
}
