package services

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"warehousecore/internal/models"
	"warehousecore/internal/repository"
)

// LEDControllerService manages LED controller records
type LEDControllerService struct {
	db *gorm.DB
}

// NewLEDControllerService creates a new service
func NewLEDControllerService() *LEDControllerService {
	return &LEDControllerService{db: repository.GetDB()}
}

// ListControllers returns all controllers with associated zone types
func (s *LEDControllerService) ListControllers() ([]models.LEDController, error) {
	if s.db == nil {
		return nil, errors.New("database not initialised")
	}

	var controllers []models.LEDController
	if err := s.db.Preload("ZoneTypes").Order("display_name ASC").Find(&controllers).Error; err != nil {
		return nil, err
	}
	return controllers, nil
}

// GetControllerByID fetches controller by numeric ID
func (s *LEDControllerService) GetControllerByID(id int) (*models.LEDController, error) {
	if s.db == nil {
		return nil, errors.New("database not initialised")
	}

	var controller models.LEDController
	if err := s.db.Preload("ZoneTypes").First(&controller, id).Error; err != nil {
		return nil, err
	}
	return &controller, nil
}

// GetControllerByIdentifier fetches controller by controller_id
func (s *LEDControllerService) GetControllerByIdentifier(identifier string) (*models.LEDController, error) {
	if s.db == nil {
		return nil, errors.New("database not initialised")
	}

	var controller models.LEDController
	if err := s.db.Preload("ZoneTypes").Where("controller_id = ?", identifier).First(&controller).Error; err != nil {
		return nil, err
	}
	return &controller, nil
}

// CreateController creates a new controller and assigns zone types
func (s *LEDControllerService) CreateController(controller *models.LEDController, zoneTypeIDs []int) (*models.LEDController, error) {
	if s.db == nil {
		return nil, errors.New("database not initialised")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(controller).Error; err != nil {
			return err
		}

		if len(zoneTypeIDs) > 0 {
			var zoneTypes []models.ZoneType
			if err := tx.Where("id IN ?", zoneTypeIDs).Find(&zoneTypes).Error; err != nil {
				return err
			}
			if err := tx.Model(controller).Association("ZoneTypes").Replace(zoneTypes); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return s.GetControllerByID(controller.ID)
}

// UpdateController updates base properties and optionally zone types
func (s *LEDControllerService) UpdateController(id int, updates map[string]interface{}, zoneTypeIDs []int) (*models.LEDController, error) {
	if s.db == nil {
		return nil, errors.New("database not initialised")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			if err := tx.Model(&models.LEDController{}).Where("id = ?", id).Updates(updates).Error; err != nil {
				return err
			}
		}
		if zoneTypeIDs != nil {
			var controller models.LEDController
			if err := tx.First(&controller, id).Error; err != nil {
				return err
			}
			var zoneTypes []models.ZoneType
			if len(zoneTypeIDs) > 0 {
				if err := tx.Where("id IN ?", zoneTypeIDs).Find(&zoneTypes).Error; err != nil {
					return err
				}
			}
			if err := tx.Model(&controller).Association("ZoneTypes").Replace(zoneTypes); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return s.GetControllerByID(id)
}

// DeleteController removes a controller
func (s *LEDControllerService) DeleteController(id int) error {
	if s.db == nil {
		return errors.New("database not initialised")
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&models.LEDController{}, id).Error; err != nil {
			return err
		}
		return nil
	})
}

// RecordHeartbeat updates last_seen timestamp for controller ID and stores telemetry data
func (s *LEDControllerService) RecordHeartbeat(identifier string, payload *models.LEDControllerHeartbeat) (*models.LEDController, error) {
	if s.db == nil {
		return nil, errors.New("database not initialised")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"last_seen": now,
		"is_active": true,
	}

	var status models.JSONMap
	if payload != nil {
		if payload.TopicSuffix != "" {
			updates["topic_suffix"] = payload.TopicSuffix
		}
		if payload.IPAddress != "" {
			updates["ip_address"] = payload.IPAddress
		}
		if payload.Hostname != "" {
			updates["hostname"] = payload.Hostname
		}
		if payload.FirmwareVersion != "" {
			updates["firmware_version"] = payload.FirmwareVersion
		}
		if payload.MacAddress != "" {
			updates["mac_address"] = payload.MacAddress
		}

		status = make(models.JSONMap)
		if payload.WifiRSSI != nil {
			status["wifi_rssi"] = *payload.WifiRSSI
		}
		if payload.UptimeSeconds != nil {
			status["uptime_seconds"] = *payload.UptimeSeconds
		}
		if payload.LedCount != nil {
			status["led_count"] = *payload.LedCount
		}
		if payload.ActiveLEDs != nil {
			status["active_leds"] = *payload.ActiveLEDs
		}
		if payload.WarehouseID != "" {
			status["warehouse_id"] = payload.WarehouseID
		}
		if payload.Status != nil {
			for k, v := range payload.Status {
				status[k] = v
			}
		}
		if len(status) > 0 {
			status["heartbeat_received_at"] = now.UTC().Format(time.RFC3339)
			updates["status_data"] = status
		} else {
			status = nil
		}
	}

	result := s.db.Model(&models.LEDController{}).
		Where("controller_id = ?", identifier).
		Updates(updates)

	if result.Error != nil {
		return nil, result.Error
	}

	if result.RowsAffected == 0 {
		controller := models.LEDController{
			ControllerID: identifier,
			DisplayName:  identifier,
			TopicSuffix:  identifier,
			IsActive:     true,
			LastSeen:     &now,
		}

		if payload != nil {
			if payload.TopicSuffix != "" {
				controller.TopicSuffix = payload.TopicSuffix
			}
			if payload.IPAddress != "" {
				value := payload.IPAddress
				controller.IPAddress = &value
			}
			if payload.Hostname != "" {
				value := payload.Hostname
				controller.Hostname = &value
			}
			if payload.FirmwareVersion != "" {
				value := payload.FirmwareVersion
				controller.FirmwareVersion = &value
			}
			if payload.MacAddress != "" {
				value := payload.MacAddress
				controller.MacAddress = &value
			}
			if status != nil && len(status) > 0 {
				// Create copy to avoid shared reference
				statusCopy := make(models.JSONMap, len(status))
				for k, v := range status {
					statusCopy[k] = v
				}
				controller.StatusData = statusCopy
			}
		}

		if controller.TopicSuffix == "" {
			controller.TopicSuffix = identifier
		}

		if err := s.db.Create(&controller).Error; err != nil {
			return nil, err
		}
		return &controller, nil
	}

	return s.GetControllerByIdentifier(identifier)
}

// GetPrimaryControllerForZoneType returns the first controller assigned to the given zone type ID
func (s *LEDControllerService) GetPrimaryControllerForZoneType(zoneTypeID int) (*models.LEDController, error) {
	if s.db == nil {
		return nil, errors.New("database not initialised")
	}

	if zoneTypeID <= 0 {
		return nil, gorm.ErrRecordNotFound
	}

	var controller models.LEDController
	err := s.db.Preload("ZoneTypes").
		Joins("JOIN led_controller_zone_types lcz ON lcz.controller_id = led_controllers.id").
		Where("lcz.zone_type_id = ?", zoneTypeID).
		Order("led_controllers.id ASC").
		First(&controller).Error

	if err != nil {
		return nil, err
	}
	return &controller, nil
}
