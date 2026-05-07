-- Backfill helpers for WarehouseCore (placeholder)
BEGIN;

CREATE TABLE IF NOT EXISTS backfill_queue (
  id serial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id integer NOT NULL,
  enqueued_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION enqueue_entity_backfill(entity text, id integer) RETURNS void AS $$
BEGIN
  INSERT INTO backfill_queue (entity_type, entity_id) VALUES (entity, id) ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMIT;
