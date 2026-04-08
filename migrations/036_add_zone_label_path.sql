-- Migration 036: Add label_path column to zones table
ALTER TABLE zones ADD COLUMN IF NOT EXISTS label_path VARCHAR(512) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_zones_label_path ON zones(label_path);
