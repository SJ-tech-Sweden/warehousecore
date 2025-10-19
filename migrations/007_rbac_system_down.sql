-- Rollback Migration 007: RBAC System and Admin Features

-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS `user_profiles`;
DROP TABLE IF EXISTS `app_settings`;
DROP TABLE IF EXISTS `zone_types`;
DROP TABLE IF EXISTS `user_roles_wh`;

-- Remove WarehouseCore roles from existing roles table
DELETE FROM `roles` WHERE `name` IN ('warehouse_admin', 'warehouse_manager', 'warehouse_worker', 'warehouse_viewer');
