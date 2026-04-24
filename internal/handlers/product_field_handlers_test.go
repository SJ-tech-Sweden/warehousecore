package handlers_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"

	"warehousecore/internal/handlers"
	"warehousecore/internal/repository"
)

// productFieldRouter builds a minimal router that mirrors the admin subrouter
// routes for product field definitions and field values.
func productFieldRouter() *mux.Router {
	router := mux.NewRouter()
	router.HandleFunc("/admin/product-field-definitions", handlers.GetProductFieldDefinitions).Methods("GET")
	router.HandleFunc("/admin/product-field-definitions", handlers.CreateProductFieldDefinition).Methods("POST")
	router.HandleFunc("/admin/product-field-definitions/{id}", handlers.UpdateProductFieldDefinition).Methods("PUT")
	router.HandleFunc("/admin/product-field-definitions/{id}", handlers.DeleteProductFieldDefinition).Methods("DELETE")
	router.HandleFunc("/admin/products/{id}/field-values", handlers.GetProductFieldValues).Methods("GET")
	router.HandleFunc("/admin/products/{id}/field-values", handlers.SetProductFieldValues).Methods("PUT")
	return router
}

// withMockDB injects a sqlmock DB into the repository global and registers a
// cleanup that restores the original DB and verifies expectations were met.
func withMockDB(t *testing.T) sqlmock.Sqlmock {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	restore := repository.WithTestSQLDB(db)
	t.Cleanup(func() {
		restore()
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet sqlmock expectations: %v", err)
		}
		db.Close()
	})
	return mock
}

// ----------------------------------------------------------------------------
// GetProductFieldDefinitions
// ----------------------------------------------------------------------------

func TestGetProductFieldDefinitions_EmptyList(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	mock.ExpectQuery(`SELECT id, name, label, field_type`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "label", "field_type", "options", "unit", "sort_order", "is_required"}))

	req := httptest.NewRequest(http.MethodGet, "/admin/product-field-definitions", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}
	var result []interface{}
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected empty list, got %d items", len(result))
	}
}

func TestGetProductFieldDefinitions_ReturnsRows(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	rows := sqlmock.NewRows([]string{"id", "name", "label", "field_type", "options", "unit", "sort_order", "is_required"}).
		AddRow(1, "cable_length", "Cable Length", "number", nil, nil, 1, false).
		AddRow(2, "connector_1", "Connector 1", "select", `["XLR","RCA"]`, nil, 2, true)

	mock.ExpectQuery(`SELECT id, name, label, field_type`).WillReturnRows(rows)

	req := httptest.NewRequest(http.MethodGet, "/admin/product-field-definitions", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}
	var result []map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(result) != 2 {
		t.Errorf("expected 2 field definitions, got %d", len(result))
	}
	if result[0]["name"] != "cable_length" {
		t.Errorf("expected first field name 'cable_length', got %q", result[0]["name"])
	}
}

// ----------------------------------------------------------------------------
// CreateProductFieldDefinition
// ----------------------------------------------------------------------------

func TestCreateProductFieldDefinition_Success(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	returning := sqlmock.NewRows([]string{"id", "name", "label", "field_type", "options", "unit", "sort_order", "is_required"}).
		AddRow(1, "cable_type", "Cable Type", "text", nil, nil, 0, false)

	mock.ExpectQuery(`INSERT INTO product_field_definitions`).
		WithArgs("cable_type", "Cable Type", "text", nil, nil, 0, false).
		WillReturnRows(returning)

	body := `{"name":"cable_type","label":"Cable Type","field_type":"text"}`
	req := httptest.NewRequest(http.MethodPost, "/admin/product-field-definitions", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", rr.Code, rr.Body.String())
	}
	var result map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if result["name"] != "cable_type" {
		t.Errorf("expected name 'cable_type', got %q", result["name"])
	}
}

func TestCreateProductFieldDefinition_InvalidFieldType(t *testing.T) {
	// No DB interactions expected — validation rejects before querying.
	_ = withMockDB(t)
	router := productFieldRouter()

	body := `{"name":"foo","label":"Foo","field_type":"invalid_type"}`
	req := httptest.NewRequest(http.MethodPost, "/admin/product-field-definitions", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid field_type, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateProductFieldDefinition_SelectMissingOptions(t *testing.T) {
	_ = withMockDB(t)
	router := productFieldRouter()

	body := `{"name":"color","label":"Color","field_type":"select"}`
	req := httptest.NewRequest(http.MethodPost, "/admin/product-field-definitions", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for select without options, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// ----------------------------------------------------------------------------
// DeleteProductFieldDefinition
// ----------------------------------------------------------------------------

func TestDeleteProductFieldDefinition_NotFound(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	result := sqlmock.NewResult(0, 0)
	mock.ExpectExec(`DELETE FROM product_field_definitions`).
		WithArgs(99).
		WillReturnResult(result)

	req := httptest.NewRequest(http.MethodDelete, "/admin/product-field-definitions/99", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for non-existent field def, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

func TestDeleteProductFieldDefinition_Success(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	result := sqlmock.NewResult(1, 1)
	mock.ExpectExec(`DELETE FROM product_field_definitions`).
		WithArgs(1).
		WillReturnResult(result)

	req := httptest.NewRequest(http.MethodDelete, "/admin/product-field-definitions/1", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// ----------------------------------------------------------------------------
// SetProductFieldValues
// ----------------------------------------------------------------------------

// TestSetProductFieldValues_NilValues verifies the no-op path: when the
// "values" key is omitted entirely (nil), the handler returns 200 without
// touching the database.
func TestSetProductFieldValues_NilValues(t *testing.T) {
	// No DB expectations — the handler must short-circuit before any query.
	_ = withMockDB(t)
	router := productFieldRouter()

	// An empty JSON object `{}` has nil Values map (key omitted).
	body := `{}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/1/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for nil values (no-op), got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// TestSetProductFieldValues_EmptyWithRequiredDefs verifies that sending an
// explicit empty map (clear-all) is rejected when required field definitions
// exist.
func TestSetProductFieldValues_EmptyWithRequiredDefs(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	// Product exists check.
	mock.ExpectQuery(`SELECT EXISTS`).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// Required field definitions check — at least one required definition exists.
	mock.ExpectQuery(`SELECT EXISTS`).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	body := `{"values":{}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/1/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when clearing values with required fields, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// TestSetProductFieldValues_ProductNotFound verifies the handler returns 404
// when the product does not exist in the database.
func TestSetProductFieldValues_ProductNotFound(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	mock.ExpectQuery(`SELECT EXISTS`).
		WithArgs(999).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	body := `{"values":{"cable_length":"5"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/999/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for non-existent product, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// TestSetProductFieldValues_UnknownFieldName verifies that submitting a field
// name that doesn't exist in product_field_definitions returns 400.
func TestSetProductFieldValues_UnknownFieldName(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	// Product exists.
	mock.ExpectQuery(`SELECT EXISTS`).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// Field definitions lookup returns no rows (unknown name).
	mock.ExpectQuery(`SELECT id, name, field_type, options, is_required`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "field_type", "options", "is_required"}))

	// Handler returns 400 before the missing-required-fields query is reached,
	// so no further DB expectations are needed.

	body := `{"values":{"nonexistent_field":"value"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/1/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown field name, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// TestSetProductFieldValues_InvalidSelectOption verifies that a value not in
// the select field's option list is rejected with 400.
func TestSetProductFieldValues_InvalidSelectOption(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	// Product exists.
	mock.ExpectQuery(`SELECT EXISTS`).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// Field definitions lookup: connector_1 is a select with options ["XLR","RCA"].
	optionsJSON := `["XLR","RCA"]`
	mock.ExpectQuery(`SELECT id, name, field_type, options, is_required`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "field_type", "options", "is_required"}).
			AddRow(2, "connector_1", "select", optionsJSON, false))

	body := `{"values":{"connector_1":"HDMI"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/1/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid select option, got %d; body: %s", rr.Code, rr.Body.String())
	}
	var errResp map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}
	if errResp["error"] == "" {
		t.Error("expected non-empty error message for invalid select option")
	}
}

// TestSetProductFieldValues_RequiredFieldMissing verifies that omitting a
// required field name from the values map (and having no prior stored value)
// is rejected with 400.
func TestSetProductFieldValues_RequiredFieldMissing(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	// Product exists.
	mock.ExpectQuery(`SELECT EXISTS`).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// Field definitions lookup: only "cable_length" is included in the request.
	mock.ExpectQuery(`SELECT id, name, field_type, options, is_required`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "field_type", "options", "is_required"}).
			AddRow(1, "cable_length", "number", nil, false))

	// Missing required fields check: "connector_1" is required and has no stored value.
	mock.ExpectQuery(`SELECT d.name`).
		WillReturnRows(sqlmock.NewRows([]string{"name"}).AddRow("connector_1"))

	body := `{"values":{"cable_length":"5"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/1/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing required field, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// TestSetProductFieldValues_SuccessfulUpsert verifies the happy path: a valid
// field value is upserted inside a transaction and the handler returns 200.
func TestSetProductFieldValues_SuccessfulUpsert(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	// Product exists.
	mock.ExpectQuery(`SELECT EXISTS`).
		WithArgs(1).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// Field definitions lookup.
	mock.ExpectQuery(`SELECT id, name, field_type, options, is_required`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "field_type", "options", "is_required"}).
			AddRow(1, "cable_length", "number", nil, false))

	// No missing required fields.
	mock.ExpectQuery(`SELECT d.name`).
		WillReturnRows(sqlmock.NewRows([]string{"name"}))

	// Transaction: begin, upsert, commit.
	mock.ExpectBegin()
	mock.ExpectExec(`INSERT INTO product_field_values`).
		WithArgs(1, 1, "5").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	body := `{"values":{"cable_length":"5"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/1/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for successful upsert, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// TestSetProductFieldValues_InvalidProductID verifies that a non-numeric
// product ID in the URL path returns 400.
func TestSetProductFieldValues_InvalidProductID(t *testing.T) {
	_ = withMockDB(t)
	router := productFieldRouter()

	body := `{"values":{"cable_length":"5"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/notanumber/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for non-numeric product ID, got %d; body: %s", rr.Code, rr.Body.String())
	}
}

// TestSetProductFieldValues_DBUnavailable verifies that a DB failure on the
// product-existence check returns 500.
func TestSetProductFieldValues_DBUnavailable(t *testing.T) {
	mock := withMockDB(t)
	router := productFieldRouter()

	mock.ExpectQuery(`SELECT EXISTS`).
		WithArgs(1).
		WillReturnError(sql.ErrConnDone)

	body := `{"values":{"cable_length":"5"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/products/1/field-values", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 when DB unavailable, got %d; body: %s", rr.Code, rr.Body.String())
	}
}
