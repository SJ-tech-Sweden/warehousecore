package middleware

import (
	"log"
	"net/http"

	"warehousecore/internal/services"
)

// RequireRole middleware ensures user has one of the required roles
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get user from context (set by AuthMiddleware)
			user, ok := GetUserFromContext(r)
			if !ok {
				http.Error(w, `{"error":"Unauthorized - No user in context"}`, http.StatusUnauthorized)
				return
			}

			// Check if user has any of the required roles
			rbacService := services.NewRBACService()
			hasRole, err := rbacService.HasAnyRole(user.UserID, roles)
			if err != nil {
				log.Printf("Error checking user roles: %v", err)
				http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
				return
			}

			if !hasRole {
				log.Printf("User %s (ID: %d) attempted to access %s without required roles: %v",
					user.Username, user.UserID, r.URL.Path, roles)
				http.Error(w, `{"error":"Forbidden - Insufficient permissions"}`, http.StatusForbidden)
				return
			}

			// User has required role - proceed
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAdmin middleware ensures user has admin role
func RequireAdmin(next http.Handler) http.Handler {
	return RequireRole("admin")(next)
}

// RequireAdminOrManager middleware ensures user has admin or manager role
func RequireAdminOrManager(next http.Handler) http.Handler {
	return RequireRole("admin", "manager")(next)
}
