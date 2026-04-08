-- Migration 037: Add varchar_pattern_ops index on devices(deviceID)
-- A plain btree index is not used by PostgreSQL for LIKE 'prefix%' queries
-- under non-C database collations. The varchar_pattern_ops operator class
-- enables efficient prefix scans on a varchar/text column regardless of the
-- active collation. This index is used by AllocateDeviceCounter in
-- internal/services/device_id.go to find the next available device ID counter.
CREATE INDEX IF NOT EXISTS idx_devices_deviceid_pattern_ops
    ON devices(deviceID varchar_pattern_ops);
