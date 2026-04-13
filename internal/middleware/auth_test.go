package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"warehousecore/internal/repository"
)

func TestExtractAPIKey_XAPIKeyHeader(t *testing.T) {
	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	req.Header.Set("X-API-Key", "test-key-123")

	got := extractAPIKey(req)
	if got != "test-key-123" {
		t.Errorf("expected %q, got %q", "test-key-123", got)
	}
}

func TestExtractAPIKey_BearerHeader(t *testing.T) {
	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	req.Header.Set("Authorization", "Bearer my-bearer-token")

	got := extractAPIKey(req)
	if got != "my-bearer-token" {
		t.Errorf("expected %q, got %q", "my-bearer-token", got)
	}
}

func TestExtractAPIKey_BearerCaseInsensitive(t *testing.T) {
	for _, scheme := range []string{"bearer", "BEARER", "Bearer", "bEaReR"} {
		req := httptest.NewRequest("GET", "/admin/zone-types", nil)
		req.Header.Set("Authorization", scheme+" my-token")

		got := extractAPIKey(req)
		if got != "my-token" {
			t.Errorf("scheme %q: expected %q, got %q", scheme, "my-token", got)
		}
	}
}

func TestExtractAPIKey_XAPIKeyTakesPrecedence(t *testing.T) {
	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	req.Header.Set("X-API-Key", "key-from-header")
	req.Header.Set("Authorization", "Bearer key-from-bearer")

	got := extractAPIKey(req)
	if got != "key-from-header" {
		t.Errorf("X-API-Key should take precedence; expected %q, got %q", "key-from-header", got)
	}
}

func TestExtractAPIKey_EmptyHeaders(t *testing.T) {
	req := httptest.NewRequest("GET", "/admin/zone-types", nil)

	got := extractAPIKey(req)
	if got != "" {
		t.Errorf("expected empty string, got %q", got)
	}
}

func TestExtractAPIKey_BearerWithWhitespace(t *testing.T) {
	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	req.Header.Set("Authorization", "  Bearer   spaced-token  ")

	got := extractAPIKey(req)
	if got != "spaced-token" {
		t.Errorf("expected %q, got %q", "spaced-token", got)
	}
}

func TestExtractAPIKey_BearerEmpty(t *testing.T) {
	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	req.Header.Set("Authorization", "Bearer ")

	got := extractAPIKey(req)
	if got != "" {
		t.Errorf("expected empty string for empty Bearer token, got %q", got)
	}
}

func TestExtractAPIKey_NonBearerAuth(t *testing.T) {
	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")

	got := extractAPIKey(req)
	if got != "" {
		t.Errorf("expected empty string for Basic auth, got %q", got)
	}
}

// withNilDB explicitly sets the repository DB handles to nil and restores
// them after the test so the tests are isolated from any prior state.
func withNilDB(t *testing.T) {
	t.Helper()
	origGorm := repository.GormDB
	origSQL := repository.DB
	repository.GormDB = nil
	repository.DB = nil
	t.Cleanup(func() {
		repository.GormDB = origGorm
		repository.DB = origSQL
	})
}

// TestAuthMiddleware_NoCredentials_NoDB verifies that when the database is
// unavailable and no credentials are provided, a 401 is returned.
func TestAuthMiddleware_NoCredentials_NoDB(t *testing.T) {
	withNilDB(t)

	handler := AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 with no credentials, got %d", rr.Code)
	}
}

// TestAuthMiddleware_InvalidAPIKey_NoDB verifies that an API key gets
// 500 when the database is unavailable (not a misleading 401).
func TestAuthMiddleware_InvalidAPIKey_NoDB(t *testing.T) {
	withNilDB(t)

	handler := AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	req.Header.Set("X-API-Key", "some-key")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// DB is nil → 500 even with an API key
	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 when DB is nil, got %d", rr.Code)
	}
	if body := rr.Body.String(); body != "{\"error\":\"Database unavailable\"}\n" {
		t.Errorf("unexpected body: %s", body)
	}
}

// TestAuthMiddleware_InvalidBearerToken_NoDB verifies that a Bearer token
// still gets 500 when the database is unavailable.
func TestAuthMiddleware_InvalidBearerToken_NoDB(t *testing.T) {
	withNilDB(t)

	handler := AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/admin/zone-types", nil)
	req.Header.Set("Authorization", "Bearer some-invalid-token")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// DB is nil → 500
	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 when DB is nil, got %d", rr.Code)
	}
}

// TestAuthMiddleware_SessionCookie_NoDB verifies that a session cookie gets
// 500 when the database is unavailable.
func TestAuthMiddleware_SessionCookie_NoDB(t *testing.T) {
	withNilDB(t)

	handler := AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "session_id", Value: "some-session-id"})
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// DB is nil → 500 (not 401)
	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 when DB is nil with session cookie, got %d", rr.Code)
	}
}

// TestAuthMiddleware_APIKey_NonAdminPath verifies that an API key on a
// non-admin path (e.g. /auth/me) is ignored and the request gets 401,
// not authenticated via API key.
func TestAuthMiddleware_APIKey_NonAdminPath(t *testing.T) {
	withNilDB(t)

	handler := AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called on non-admin path with API key")
	}))

	req := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
	req.Header.Set("X-API-Key", "some-admin-key")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// API key ignored on non-admin path → 401 "No session"
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 on non-admin path with API key, got %d", rr.Code)
	}
}

// TestIsAdminPath verifies the admin-path detection helper.
func TestIsAdminPath(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{"/api/v1/admin/zone-types", true},
		{"/api/v1/admin/api-keys", true},
		{"/admin/users", true},
		{"/api/v1/admin", true},
		{"/api/v1/auth/me", false},
		{"/api/v1/scans", false},
		{"/api/v1/scans/history", false},
		{"/api/v1/administrator/settings", false}, // not a real /admin/ segment
	}
	for _, tt := range tests {
		if got := isAdminPath(tt.path); got != tt.want {
			t.Errorf("isAdminPath(%q) = %v, want %v", tt.path, got, tt.want)
		}
	}
}
