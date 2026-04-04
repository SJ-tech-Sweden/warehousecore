-- Add a unique index on (product_name, supplier_name) in rental_equipment.
-- This enables INSERT ... ON CONFLICT DO UPDATE (atomic upsert) for the
-- Eventory sync, and also prevents accidental duplicate rows.
--
-- Step 1: Remove duplicate rows, keeping the row with the highest equipment_id
-- (i.e. the most recently inserted). Note: this uses ROW_NUMBER() OVER to rank
-- rows within each (product_name, supplier_name) group, but it still requires
-- a full scan and partitioning of the entire rental_equipment table. On large
-- datasets this can be a long-running operation that blocks concurrent writes
-- to the table. Run during a maintenance window if needed.
DELETE FROM rental_equipment
WHERE equipment_id IN (
    SELECT equipment_id
    FROM (
        SELECT equipment_id,
               ROW_NUMBER() OVER (
                   PARTITION BY product_name, supplier_name
                   ORDER BY equipment_id DESC
               ) AS rn
        FROM rental_equipment
    ) t
    WHERE rn > 1
);

-- Step 2: Add the unique index using CONCURRENTLY to avoid blocking writes to
-- rental_equipment during index creation. Note: CONCURRENTLY cannot run inside
-- a transaction, so this script must be applied outside of a transaction block
-- (psql default behavior applies the file outside a transaction).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_rental_equipment_name_supplier
    ON rental_equipment (product_name, supplier_name);
