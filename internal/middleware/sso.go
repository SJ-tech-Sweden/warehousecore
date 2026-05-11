package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"warehousecore/internal/models"
	"warehousecore/internal/repository"
)

type ssoClaims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Exp      int64  `json:"exp,omitempty"`
	Iat      int64  `json:"iat,omitempty"`
}

type ssoHeader struct {
	Alg string `json:"alg"`
}

var ssoFallbackSecretWarning sync.Once

func ssoSigningKey() []byte {
	if k := strings.TrimSpace(os.Getenv("SSO_JWT_SECRET")); k != "" {
		return []byte(k)
	}
	if k := strings.TrimSpace(os.Getenv("ENCRYPTION_KEY")); k != "" {
		ssoFallbackSecretWarning.Do(func() {
			log.Printf("[SSO] WARNING: SSO_JWT_SECRET is unset; falling back to ENCRYPTION_KEY for SSO token verification")
		})
		return []byte(k)
	}
	return nil
}

// parseAndVerifyJWT verifies an HS256 JWT and returns the claims.
func parseAndVerifyJWT(tokenStr string, key []byte) (*ssoClaims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}
	hdrB, err := base64RawURLDecode(parts[0])
	if err != nil {
		return nil, err
	}
	var hdr ssoHeader
	if err := json.Unmarshal(hdrB, &hdr); err != nil {
		return nil, fmt.Errorf("invalid token header")
	}
	if !strings.EqualFold(hdr.Alg, "HS256") {
		return nil, fmt.Errorf("unsupported token alg")
	}
	payloadB, err := base64RawURLDecode(parts[1])
	if err != nil {
		return nil, err
	}
	sig, err := base64RawURLDecode(parts[2])
	if err != nil {
		return nil, err
	}

	// verify signature (HS256)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(parts[0] + "." + parts[1]))
	expected := mac.Sum(nil)
	if !hmac.Equal(sig, expected) {
		return nil, fmt.Errorf("invalid signature")
	}

	var claims ssoClaims
	if err := json.Unmarshal(payloadB, &claims); err != nil {
		return nil, err
	}

	if claims.Exp != 0 && time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}

	return &claims, nil
}

func base64RawURLDecode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

// SSOMiddleware verifies an SSO JWT (cookie "sso_token" or Bearer token).
// If valid, it loads a user record either from the local DB or (optionally)
// via the RentalCore API when RENTALCORE_BASE_URL is configured. The user is
// set into request context using the same UserContextKey.
func SSOMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if existingUser, ok := r.Context().Value(UserContextKey).(*models.User); ok && existingUser != nil && existingUser.UserID != 0 {
			next.ServeHTTP(w, r)
			return
		}

		// Look for token in cookie first
		var tokenStr string
		if c, err := r.Cookie("sso_token"); err == nil && c.Value != "" {
			tokenStr = c.Value
		}
		// Fallback to Authorization header
		if tokenStr == "" {
			if auth := strings.TrimSpace(r.Header.Get("Authorization")); auth != "" {
				parts := strings.Fields(auth)
				if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
					tokenStr = parts[1]
				}
			}
		}

		if tokenStr == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Parse and verify token (HS256)
		signingKey := ssoSigningKey()
		if len(signingKey) == 0 {
			next.ServeHTTP(w, r)
			return
		}

		claims, err := parseAndVerifyJWT(tokenStr, signingKey)
		if err != nil {
			// Invalid token — treat as unauthenticated
			next.ServeHTTP(w, r)
			return
		}

		// Build a minimal user from claims
		var user models.User
		user.UserID = claims.UserID
		user.Username = claims.Username
		user.IsActive = true

		// Try to load richer user info from local DB if available
		db := repository.GetDB()
		if db != nil {
			var dbUser models.User
			result := db.Where("userid = ? AND is_active = ?", claims.UserID, true).Limit(1).Find(&dbUser)
			if result.Error == nil && result.RowsAffected > 0 {
				dbUser.PasswordHash = ""
				user = dbUser
			}
		}

		// Optionally, fetch authoritative user data from RentalCore API
		if os.Getenv("RENTALCORE_BASE_URL") != "" {
			rcBase := strings.TrimSuffix(os.Getenv("RENTALCORE_BASE_URL"), "/")
			url := fmt.Sprintf("%s/api/v1/security/auth/users/%d", rcBase, claims.UserID)
			req, _ := http.NewRequest(http.MethodGet, url, nil)
			req.Header.Set("Accept", "application/json")
			if k := os.Getenv("RENTALCORE_API_KEY"); k != "" {
				req.Header.Set("X-API-Key", k)
			}
			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Do(req)
			if err == nil && resp != nil {
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					body, _ := io.ReadAll(resp.Body)
					var rcUser models.User
					if jsonErr := json.Unmarshal(body, &rcUser); jsonErr == nil {
						rcUser.PasswordHash = ""
						user = rcUser
					}
				}
			}
		}

		// Insert user into context and continue
		ctx := context.WithValue(r.Context(), UserContextKey, &user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
