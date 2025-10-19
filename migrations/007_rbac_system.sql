-- Migration 007: RBAC System and Admin Features
-- Creates tables for Role-Based Access Control, Zone Types, App Settings, and User Profiles

-- =======================
-- 1. ROLES TABLE (Use existing RentalCore roles table)
-- =======================
-- Note: roles table already exists in RentalCore with roleID as PK
-- We'll use the existing table and add WarehouseCore-specific roles if needed

-- Add WarehouseCore roles to existing table if they don't exist
INSERT IGNORE INTO `roles` (`name`, `display_name`, `description`, `permissions`, `is_system_role`, `is_active`) VALUES
  ('warehouse_admin', 'Warehouse Admin', 'Full warehouse management access', JSON_ARRAY('warehouse.*'), 1, 1),
  ('warehouse_manager', 'Warehouse Manager', 'Warehouse operations management', JSON_ARRAY('warehouse.manage', 'warehouse.reports'), 1, 1),
  ('warehouse_worker', 'Warehouse Worker', 'Warehouse tasks and scanning', JSON_ARRAY('warehouse.scan', 'warehouse.view'), 1, 1),
  ('warehouse_viewer', 'Warehouse Viewer', 'Read-only warehouse access', JSON_ARRAY('warehouse.view'), 1, 1);

-- =======================
-- 2. USER_ROLES TABLE
-- =======================
-- Note: Using roleID from existing roles table
CREATE TABLE IF NOT EXISTS `user_roles_wh` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'FK to users.userID',
  `role_id` INT NOT NULL COMMENT 'FK to roles.roleID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_role_wh` (`user_id`, `role_id`),
  INDEX idx_user_id_wh (`user_id`),
  INDEX idx_role_id_wh (`role_id`),
  CONSTRAINT `fk_user_roles_wh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_wh_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`roleID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WarehouseCore user-to-role assignments';

-- =======================
-- 3. ZONE_TYPES TABLE
-- =======================
CREATE TABLE IF NOT EXISTS `zone_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(64) NOT NULL UNIQUE COMMENT 'Machine-readable key: shelf, bin, eurobox, etc.',
  `label` VARCHAR(128) NOT NULL COMMENT 'Display name',
  `description` TEXT NULL COMMENT 'Detailed description',
  `default_led_pattern` ENUM('solid', 'breathe', 'blink') DEFAULT 'breathe' COMMENT 'Default LED pattern',
  `default_led_color` VARCHAR(9) DEFAULT '#FF4500' COMMENT 'Default LED color (hex)',
  `default_intensity` TINYINT UNSIGNED DEFAULT 255 COMMENT 'Default LED intensity (0-255)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_zone_type_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configurable zone types with LED defaults';

-- =======================
-- 4. APP_SETTINGS TABLE
-- =======================
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `scope` ENUM('global', 'warehousecore') NOT NULL DEFAULT 'warehousecore' COMMENT 'Setting scope',
  `k` VARCHAR(128) NOT NULL COMMENT 'Setting key',
  `v` JSON NOT NULL COMMENT 'Setting value (JSON)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_scope_key` (`scope`, `k`),
  INDEX idx_setting_key (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Application configuration settings';

-- =======================
-- 5. USER_PROFILES TABLE
-- =======================
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL UNIQUE COMMENT 'FK to users.userID',
  `display_name` VARCHAR(128) NULL COMMENT 'Custom display name',
  `avatar_url` VARCHAR(512) NULL COMMENT 'Avatar image URL',
  `prefs` JSON NULL COMMENT 'UI preferences (dark mode, table density, etc.)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_profile_user_id (`user_id`),
  CONSTRAINT `fk_user_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WarehouseCore-specific user profiles';

-- =======================
-- SEED DATA
-- =======================

-- Insert default zone types
INSERT IGNORE INTO `zone_types` (`key`, `label`, `description`, `default_led_pattern`, `default_led_color`, `default_intensity`) VALUES
  ('shelf', 'Regal', 'Standard warehouse shelf', 'breathe', '#FF4500', 255),
  ('bin', 'Fach', 'Storage bin or compartment', 'breathe', '#FF4500', 255),
  ('eurobox', 'Eurobox', 'European standard box', 'breathe', '#00FF00', 220),
  ('gitterbox', 'Gitterbox', 'Wire mesh container', 'solid', '#0088FF', 200),
  ('flightcase', 'Flight Case', 'Transport flight case', 'solid', '#FF00FF', 200),
  ('rack', 'Rack', 'Equipment rack', 'breathe', '#FFAA00', 240),
  ('stage', 'Bühne', 'Stage area', 'blink', '#FF0000', 180),
  ('vehicle', 'Fahrzeug', 'Transport vehicle', 'solid', '#00FFFF', 160);

-- Insert default LED settings for single bin highlight
INSERT IGNORE INTO `app_settings` (`scope`, `k`, `v`) VALUES
  ('warehousecore', 'led.single_bin.default', JSON_OBJECT(
    'color', '#FF4500',
    'pattern', 'breathe',
    'intensity', 255
  )),
  ('warehousecore', 'ui.theme', JSON_OBJECT(
    'darkMode', true,
    'accentColor', '#EF4444'
  ));
