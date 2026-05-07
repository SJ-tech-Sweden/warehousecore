package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func signHS256(claims ssoClaims, key []byte) (string, error) {
	hdr := map[string]string{"alg": "HS256", "typ": "JWT"}
	hdrB, _ := json.Marshal(hdr)
	plB, _ := json.Marshal(claims)
	h := base64.RawURLEncoding.EncodeToString(hdrB)
	p := base64.RawURLEncoding.EncodeToString(plB)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(h + "." + p))
	sig := mac.Sum(nil)
	s := base64.RawURLEncoding.EncodeToString(sig)
	return h + "." + p + "." + s, nil
}

func TestSSOMiddleware_CookieCreatesUserContext(t *testing.T) {
	os.Setenv("SSO_JWT_SECRET", "test-secret-ss0")
	defer os.Unsetenv("SSO_JWT_SECRET")

	claims := ssoClaims{
		UserID:   77,
		Username: "alice",
		Exp:      time.Now().Add(1 * time.Hour).Unix(),
		Iat:      time.Now().Unix(),
	}
	s, err := signHS256(claims, ssoSigningKey())
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "sso_token", Value: s})
	rr := httptest.NewRecorder()

	handler := SSOMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := GetUserFromContext(r)
		if !ok || user == nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rr.Code)
	}
}

func TestSSOMiddleware_InvalidTokenDoesNotPanic(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "sso_token", Value: "bad.token.here"})
	rr := httptest.NewRecorder()

	handler := SSOMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// should continue without user
		user, ok := GetUserFromContext(r)
		if ok && user != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rr.Code)
	}
}
