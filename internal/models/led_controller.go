package models

import "time"

// LEDController represents a physical LED controller device (e.g., ESP32)
type LEDController struct {
	ID           int        `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	ControllerID string     `json:"controller_id" gorm:"column:controller_id;uniqueIndex;not null"`
	DisplayName  string     `json:"display_name" gorm:"column:display_name;not null"`
	TopicSuffix  string     `json:"topic_suffix" gorm:"column:topic_suffix;not null"`
	IsActive     bool       `json:"is_active" gorm:"column:is_active;not null;default:true"`
	LastSeen     *time.Time `json:"last_seen" gorm:"column:last_seen"`
	Metadata     JSONMap    `json:"metadata" gorm:"column:metadata;type:json"`
	CreatedAt    time.Time  `json:"created_at" gorm:"column:created_at"`
	UpdatedAt    time.Time  `json:"updated_at" gorm:"column:updated_at"`

	ZoneTypes []ZoneType `json:"zone_types,omitempty" gorm:"many2many:led_controller_zone_types;joinForeignKey:ControllerID;JoinReferences:ZoneTypeID"`
}

// TableName specifies table name for LEDController
func (LEDController) TableName() string {
	return "led_controllers"
}

// LEDControllerZoneType represents the mapping between controllers and zone types
type LEDControllerZoneType struct {
	ControllerID int       `json:"controller_id" gorm:"column:controller_id;primaryKey"`
	ZoneTypeID   int       `json:"zone_type_id" gorm:"column:zone_type_id;primaryKey"`
	CreatedAt    time.Time `json:"created_at" gorm:"column:created_at"`
}

// TableName specifies table name
func (LEDControllerZoneType) TableName() string {
	return "led_controller_zone_types"
}
