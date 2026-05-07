-- Initial consolidated schema for WarehouseCore (minimal, idempotent)
-- This migration creates core tables required for a fresh WarehouseCore deployment.

BEGIN;

-- Roles (shared core)
CREATE TABLE IF NOT EXISTS roles (
  roleid SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150),
  description TEXT,
  scope VARCHAR(50) DEFAULT 'warehousecore',
  is_system_role BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  permissions JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users (auth)
CREATE TABLE IF NOT EXISTS users (
  userid SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys for service access
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  productID SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  categoryID INT,
  manufacturerID INT,
  description TEXT,
  website_visible BOOLEAN DEFAULT FALSE
);

-- Devices (warehouse inventory)
CREATE TABLE IF NOT EXISTS devices (
  deviceID VARCHAR(255) PRIMARY KEY,
  productID INT REFERENCES products(productID),
  serialnumber TEXT,
  status VARCHAR(50) DEFAULT 'free',
  zone_id INT,
  condition_rating NUMERIC DEFAULT 5.0,
  usage_hours NUMERIC DEFAULT 0.0,
  barcode TEXT
);

-- Zones (storage locations)
CREATE TABLE IF NOT EXISTS zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  barcode VARCHAR(255),
  description TEXT
);

-- Cases
CREATE TABLE IF NOT EXISTS cases (
  caseID SERIAL PRIMARY KEY,
  name VARCHAR(255),
  description TEXT
);

-- Product packages
CREATE TABLE IF NOT EXISTS product_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT
);

COMMIT;

-- Additional indexes, api_key hash sync, and helpers
BEGIN;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_devices_product ON devices(productID);
CREATE INDEX IF NOT EXISTS idx_devices_zone ON devices(zone_id);

-- Ensure api_keys.key_hash is populated via trigger using md5 (simple)
CREATE OR REPLACE FUNCTION sync_api_key_hashes() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.key_hash IS NULL OR NEW.key_hash = '' THEN
      -- If caller provided a plain key in a transient column 'key', hash it
      IF TG_OP = 'INSERT' AND NEW.key_hash IS NULL THEN
        -- no-op (expect callers to set key_hash explicitly), but keep for safety
        NEW.key_hash := md5(COALESCE(NEW.name, '') || NOW()::text || FLOOR(RANDOM()*1000000)::text);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_api_key_hashes ON api_keys;
CREATE TRIGGER trg_sync_api_key_hashes
BEFORE INSERT OR UPDATE ON api_keys
FOR EACH ROW EXECUTE FUNCTION sync_api_key_hashes();

COMMIT;

