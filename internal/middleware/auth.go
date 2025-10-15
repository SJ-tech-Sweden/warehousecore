package middleware

import (
	"context"
	"net/http"
	"time"

	"storagecore/internal/models"
	"storagecore/internal/repository"
)

type contextKey string

const UserContextKey = contextKey("user")

// AuthMiddleware validates session and loads user
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get session cookie
		cookie, err := r.Cookie("session_id")
		if err != nil || cookie.Value == "" {
			// No session cookie - return 401
			http.Error(w, `{"error":"Unauthorized - No session"}`, http.StatusUnauthorized)
			return
		}

		// Validate session in database
		db := repository.GetDB()
		if db == nil {
			http.Error(w, `{"error":"Database unavailable"}`, http.StatusInternalServerError)
			return
		}

		var session models.Session
		err = db.Preload("User").
			Where("session_id = ? AND expires_at > ?", cookie.Value, time.Now()).
			First(&session).Error

		if err != nil {
			// Invalid or expired session
			http.Error(w, `{"error":"Unauthorized - Invalid session"}`, http.StatusUnauthorized)
			return
		}

		// Check if user is active
		if !session.User.IsActive {
			http.Error(w, `{"error":"Unauthorized - User inactive"}`, http.StatusUnauthorized)
			return
		}

		// Add user to request context
		ctx := context.WithValue(r.Context(), UserContextKey, &session.User)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuthMiddleware loads user if session exists, but doesn't require it
func OptionalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get session cookie
		cookie, err := r.Cookie("session_id")
		if err != nil || cookie.Value == "" {
			// No session - continue without user
			next.ServeHTTP(w, r)
			return
		}

		// Try to validate session
		db := repository.GetDB()
		if db != nil {
			var session models.Session
			err = db.Preload("User").
				Where("session_id = ? AND expires_at > ?", cookie.Value, time.Now()).
				First(&session).Error

			if err == nil && session.User.IsActive {
				// Valid session - add user to context
				ctx := context.WithValue(r.Context(), UserContextKey, &session.User)
				r = r.WithContext(ctx)
			}
		}

		next.ServeHTTP(w, r)
	})
}

// GetUserFromContext retrieves the user from request context
func GetUserFromContext(r *http.Request) (*models.User, bool) {
	user, ok := r.Context().Value(UserContextKey).(*models.User)
	return user, ok
}
