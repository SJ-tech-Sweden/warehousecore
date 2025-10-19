package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"

    "github.com/gorilla/mux"
    "warehousecore/internal/middleware"
    "warehousecore/internal/models"
    "warehousecore/internal/services"
    "warehousecore/internal/validation"
)

// ===========================
// ZONE TYPES HANDLERS
// ===========================

// GetZoneTypes returns all zone types
func GetZoneTypes(w http.ResponseWriter, r *http.Request) {
	adminService := services.NewAdminService()
	zoneTypes, err := adminService.GetAllZoneTypes()
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, zoneTypes)
}

// GetZoneType returns a single zone type by ID
func GetZoneType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}

	adminService := services.NewAdminService()
	zoneType, err := adminService.GetZoneTypeByID(id)
	if err != nil {
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "Zone type not found"})
		return
	}

	respondJSON(w, http.StatusOK, zoneType)
}

// CreateZoneType creates a new zone type
func CreateZoneType(w http.ResponseWriter, r *http.Request) {
	var zoneType models.ZoneType
	if err := json.NewDecoder(r.Body).Decode(&zoneType); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	// Validate required fields
	if zoneType.Key == "" || zoneType.Label == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Key and label are required"})
		return
	}

    // Validate LED defaults if provided
    if zoneType.DefaultLEDPattern != "" && !validation.ValidatePattern(zoneType.DefaultLEDPattern) {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid LED pattern. Must be solid, breathe, or blink"})
        return
    }
    if zoneType.DefaultLEDColor != "" && !validation.ValidateColorHex(zoneType.DefaultLEDColor) {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid color. Use #RRGGBB or #AARRGGBB"})
        return
    }
    if zoneType.DefaultIntensity > 255 {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid intensity. Must be 0-255"})
        return
    }

	adminService := services.NewAdminService()
	if err := adminService.CreateZoneType(&zoneType); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusCreated, zoneType)
}

// UpdateZoneType updates an existing zone type
func UpdateZoneType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}

	var updates models.ZoneType
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

    // Validate LED defaults if provided
    if updates.DefaultLEDPattern != "" && !validation.ValidatePattern(updates.DefaultLEDPattern) {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid LED pattern"})
        return
    }
    if updates.DefaultLEDColor != "" && !validation.ValidateColorHex(updates.DefaultLEDColor) {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid color. Use #RRGGBB or #AARRGGBB"})
        return
    }
    if updates.DefaultIntensity > 255 {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid intensity. Must be 0-255"})
        return
    }

	adminService := services.NewAdminService()
	if err := adminService.UpdateZoneType(id, &updates); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Fetch and return updated zone type
	zoneType, _ := adminService.GetZoneTypeByID(id)
	respondJSON(w, http.StatusOK, zoneType)
}

// DeleteZoneType deletes a zone type
func DeleteZoneType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID"})
		return
	}

	adminService := services.NewAdminService()
	if err := adminService.DeleteZoneType(id); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Zone type deleted successfully"})
}

// ===========================
// LED DEFAULTS HANDLERS
// ===========================

// GetLEDSingleBinDefault returns LED defaults for single bin highlight
func GetLEDSingleBinDefault(w http.ResponseWriter, r *http.Request) {
	adminService := services.NewAdminService()
	defaults, err := adminService.GetLEDSingleBinDefault()
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, defaults)
}

// UpdateLEDSingleBinDefault updates LED defaults for single bin highlight
func UpdateLEDSingleBinDefault(w http.ResponseWriter, r *http.Request) {
	var payload models.LEDSingleBinDefault
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

    // Validate pattern
    if !validation.ValidatePattern(payload.Pattern) {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid pattern. Must be solid, breathe, or blink"})
        return
    }

    // Validate color
    if !validation.ValidateColorHex(payload.Color) {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid color. Use #RRGGBB or #AARRGGBB"})
        return
    }

    // Validate intensity
    if payload.Intensity > 255 {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid intensity. Must be 0-255"})
        return
    }

	adminService := services.NewAdminService()
	if err := adminService.SetLEDSingleBinDefault(payload.Color, payload.Pattern, payload.Intensity); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, payload)
}

// ===========================
// ROLES HANDLERS
// ===========================

// GetRoles returns all available roles
func GetRoles(w http.ResponseWriter, r *http.Request) {
	rbacService := services.NewRBACService()
	roles, err := rbacService.GetAllRoles()
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, roles)
}

// GetUsersWithRoles returns all users with their assigned roles
func GetUsersWithRoles(w http.ResponseWriter, r *http.Request) {
	rbacService := services.NewRBACService()
	users, err := rbacService.GetUsersWithRoles()
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, users)
}

// GetUserRoles returns roles for a specific user
func GetUserRoles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
		return
	}

	rbacService := services.NewRBACService()
	roles, err := rbacService.GetUserRoles(uint(userID))
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, roles)
}

// UpdateUserRoles updates roles for a specific user
func UpdateUserRoles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
		return
	}

	var payload struct {
		RoleIDs []int `json:"role_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	rbacService := services.NewRBACService()
	if err := rbacService.SetUserRoles(uint(userID), payload.RoleIDs); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Return updated roles
	roles, _ := rbacService.GetUserRoles(uint(userID))
	respondJSON(w, http.StatusOK, roles)
}

// ===========================
// PROFILE HANDLERS
// ===========================

// GetMyProfile returns the current user's profile
func GetMyProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	adminService := services.NewAdminService()
	rbacService := services.NewRBACService()

	profile, err := adminService.GetProfileWithUser(user.UserID)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Add user roles to response
	roles, _ := rbacService.GetUserRoles(user.UserID)

	response := map[string]interface{}{
		"profile": profile,
		"roles":   roles,
	}

	respondJSON(w, http.StatusOK, response)
}

// UpdateMyProfile updates the current user's profile
func UpdateMyProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	var payload struct {
		DisplayName string          `json:"display_name"`
		AvatarURL   string          `json:"avatar_url"`
		Prefs       models.JSONMap  `json:"prefs"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	adminService := services.NewAdminService()
	if err := adminService.UpdateUserProfile(user.UserID, payload.DisplayName, payload.AvatarURL, payload.Prefs); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Return updated profile
	profile, _ := adminService.GetProfileWithUser(user.UserID)
	respondJSON(w, http.StatusOK, profile)
}
