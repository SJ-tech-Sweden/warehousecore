package middleware

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

// ServiceKeyMiddleware authenticates inter-service requests by comparing the
// X-API-Key header against the SERVICE_API_KEY environment variable.
// This is intentionally simpler than the DB-backed APIKeyMiddleware because
// service-to-service credentials are managed via environment configuration
// rather than the api_keys table.
func ServiceKeyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expected := strings.TrimSpace(os.Getenv("SERVICE_API_KEY"))
		incoming := strings.TrimSpace(r.Header.Get("X-API-Key"))

		w.Header().Set("Content-Type", "application/json")

		if incoming == "" {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "missing API key"}) //nolint:errcheck
			return
		}

		if expected == "" {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"error": "service API key not configured"}) //nolint:errcheck
			return
		}

		if len(incoming) == len(expected) && subtle.ConstantTimeCompare([]byte(incoming), []byte(expected)) == 1 {
			next.ServeHTTP(w, r)
			return
		}

		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid API key"}) //nolint:errcheck
	})
}
