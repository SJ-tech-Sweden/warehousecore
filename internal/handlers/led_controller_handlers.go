package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"warehousecore/internal/models"
	"warehousecore/internal/services"
)

type ledControllerRequest struct {
	ControllerID string         `json:"controller_id"`
	DisplayName  string         `json:"display_name"`
	TopicSuffix  string         `json:"topic_suffix"`
	IsActive     *bool          `json:"is_active"`
	Metadata     models.JSONMap `json:"metadata"`
	ZoneTypeIDs  []int          `json:"zone_type_ids"`
}

// ListLEDControllers returns all registered controllers
func ListLEDControllers(w http.ResponseWriter, r *http.Request) {
	service := services.NewLEDControllerService()
	controllers, err := service.ListControllers()
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	respondJSON(w, http.StatusOK, controllers)
}

// CreateLEDController registers a new controller
func CreateLEDController(w http.ResponseWriter, r *http.Request) {
	var payload ledControllerRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if payload.ControllerID == "" || payload.DisplayName == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "controller_id and display_name are required"})
		return
	}

	topic := payload.TopicSuffix
	if topic == "" {
		topic = payload.ControllerID
	}

	controller := &models.LEDController{
		ControllerID: payload.ControllerID,
		DisplayName:  payload.DisplayName,
		TopicSuffix:  topic,
		Metadata:     payload.Metadata,
		IsActive:     true,
	}

	if payload.IsActive != nil {
		controller.IsActive = *payload.IsActive
	}

	service := services.NewLEDControllerService()
	created, err := service.CreateController(controller, payload.ZoneTypeIDs)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	respondJSON(w, http.StatusCreated, created)
}

// UpdateLEDController updates controller properties
func UpdateLEDController(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid controller id"})
		return
	}

	var payload ledControllerRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	updates := map[string]interface{}{}

	if payload.DisplayName != "" {
		updates["display_name"] = payload.DisplayName
	}
	if payload.TopicSuffix != "" {
		updates["topic_suffix"] = payload.TopicSuffix
	}
	if payload.Metadata != nil {
		updates["metadata"] = payload.Metadata
	}
	if payload.IsActive != nil {
		updates["is_active"] = *payload.IsActive
	}

	service := services.NewLEDControllerService()
	updated, err := service.UpdateController(id, updates, payload.ZoneTypeIDs)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

// DeleteLEDController removes a controller
func DeleteLEDController(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid controller id"})
		return
	}

	service := services.NewLEDControllerService()
	if err := service.DeleteController(id); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// LEDControllerHeartbeat handles heartbeat updates from controllers
func LEDControllerHeartbeat(w http.ResponseWriter, r *http.Request) {
	identifier := mux.Vars(r)["controller_id"]
	if identifier == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "controller_id required"})
		return
	}

	var payload *models.LEDControllerHeartbeat
	if r.Body != nil && r.ContentLength != 0 {
		var body models.LEDControllerHeartbeat
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid heartbeat payload"})
			return
		}
		if body.ControllerID != "" {
			identifier = body.ControllerID
		}
		// ensure empty maps treated as nil
		if body.Status != nil && len(body.Status) == 0 {
			body.Status = nil
		}
		payload = &body
	}

	service := services.NewLEDControllerService()
	controller, err := service.RecordHeartbeat(identifier, payload)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "ok",
		"controller_id": identifier,
		"controller":    controller,
		"received_at":   time.Now().UTC(),
	})
}
