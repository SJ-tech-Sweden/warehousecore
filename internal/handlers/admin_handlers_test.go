package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"warehousecore/internal/handlers"
	"warehousecore/internal/repository"
)

func adminRouter() *mux.Router {
	r := mux.NewRouter()
	r.HandleFunc("/admin/roles", handlers.CreateRole).Methods("POST")
	r.HandleFunc("/admin/users", handlers.CreateUser).Methods("POST")
	return r
}

// reuse withMockDB helper pattern from other handler tests
func withAdminMockDB(t *testing.T) sqlmock.Sqlmock {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	gormDB, err := gorm.Open(postgres.New(postgres.Config{
		DriverName:           "sqlmock",
		Conn:                 db,
		PreferSimpleProtocol: true,
	}), &gorm.Config{})
	if err != nil {
		db.Close()
		t.Fatalf("failed to create gorm db: %v", err)
	}

	restore := repository.WithTestDatabases(db, gormDB)
	t.Cleanup(func() {
		restore()
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet sqlmock expectations: %v", err)
		}
		db.Close()
	})
	return mock
}

func TestCreateRole_Success(t *testing.T) {
	mock := withAdminMockDB(t)
	router := adminRouter()

	// Expect gorm create wrapped in a transaction.
	mock.ExpectBegin()
	rows := sqlmock.NewRows([]string{"roleid"}).AddRow(10)
	mock.ExpectQuery(`INSERT INTO "roles"`).WillReturnRows(rows)
	mock.ExpectCommit()

	body := `{"name":"custom_role","description":"desc"}`
	req := httptest.NewRequest(http.MethodPost, "/admin/roles", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", rr.Code, rr.Body.String())
	}
	var res map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["name"] != "custom_role" {
		t.Errorf("expected role name 'custom_role', got %v", res["name"])
	}
}

func TestCreateUser_Success(t *testing.T) {
	mock := withAdminMockDB(t)
	router := adminRouter()

	// Uniqueness checks for username and email.
	mock.ExpectQuery(`SELECT 1 FROM users WHERE username`).WillReturnRows(sqlmock.NewRows([]string{"?column?"}))
	mock.ExpectQuery(`SELECT 1 FROM users WHERE email`).WillReturnRows(sqlmock.NewRows([]string{"?column?"}))

	// Expect INSERT INTO users ... RETURNING userid
	mock.ExpectExec(`INSERT INTO users`).WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(1, 1))

	// Then Select user by username
	userRow := sqlmock.NewRows([]string{"userid", "username", "email", "password_hash", "first_name", "last_name", "is_active"}).AddRow(42, "jdoe", "jdoe@example.com", "hash", "John", "Doe", true)
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "users" WHERE username = $1 ORDER BY "users"."userid" LIMIT $2`)).
		WithArgs("jdoe", sqlmock.AnyArg()).
		WillReturnRows(userRow)

	// User profile check - return no rows so insert happens
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "user_profiles" WHERE user_id = $1 ORDER BY "user_profiles"."id" LIMIT $2`)).
		WithArgs(42, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	body := `{"username":"jdoe","email":"jdoe@example.com","password":"secretpw","first_name":"John","last_name":"Doe"}`
	req := httptest.NewRequest(http.MethodPost, "/admin/users", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", rr.Code, rr.Body.String())
	}
	var res map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["user_id"] == nil {
		t.Errorf("expected user_id in response")
	}
}
