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
  INSERT INTO backfill_queue (entity_type, entity_id)
  SELECT $1, $2
  WHERE NOT EXISTS (
    SELECT 1
    FROM backfill_queue
    WHERE entity_type = $1
      AND entity_id = $2
  );
END;
$$ LANGUAGE plpgsql;

COMMIT;
