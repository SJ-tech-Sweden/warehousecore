package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"

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

func TestCreateRole_Success(t *testing.T) {
	mock := withMockDB(t)
	router := adminRouter()

	// Expect an INSERT into roles returning roleid
	rows := sqlmock.NewRows([]string{"roleid", "name", "description"}).AddRow(10, "custom_role", "desc")
	mock.ExpectQuery(`INSERT INTO roles`).WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg()).WillReturnRows(rows)

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
	mock := withMockDB(t)
	router := adminRouter()

	// Expect INSERT INTO users ... RETURNING userid
	mock.ExpectQuery(`INSERT INTO users`).WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).WillReturnRows(sqlmock.NewRows([]string{"userid"}).AddRow(42))

	// Then Select user by username
	userRow := sqlmock.NewRows([]string{"userid", "username", "email", "password_hash", "first_name", "last_name", "is_active"}).AddRow(42, "jdoe", "jdoe@example.com", "hash", "John", "Doe", true)
	mock.ExpectQuery(`SELECT`).WithArgs("jdoe").WillReturnRows(userRow)

	// User profile check - return no rows so insert happens
	mock.ExpectQuery(`SELECT`).WithArgs(42).WillReturnRows(sqlmock.NewRows([]string{"id"}))
	// Expect INSERT into user_profiles
	mock.ExpectExec(`INSERT INTO user_profiles`).WillReturnResult(sqlmock.NewResult(1, 1))

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
