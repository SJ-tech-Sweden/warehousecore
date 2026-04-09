-- Migration 037: Replace the plain devices(deviceID) index with a
-- varchar_pattern_ops index for efficient LIKE 'prefix%' queries under
-- non-C database collations. This index is used by AllocateDeviceCounter in
-- internal/services/device_id.go to find the next available device ID counter.
--
-- The plain index idx_devices_deviceid_pattern (created in migration 030) is
-- dropped here to avoid maintaining two redundant indexes on the same column.
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Apply this file outside of BEGIN/COMMIT (e.g. psql -f 037_...sql), NOT via
-- a migration runner that wraps every file in a transaction. If your runner
-- always uses transactions, replace CONCURRENTLY with a plain CREATE INDEX
-- (which takes a stronger lock but runs inside a transaction).
DROP INDEX IF EXISTS idx_devices_deviceid_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_deviceid_pattern_ops
    ON devices(deviceID varchar_pattern_ops);
