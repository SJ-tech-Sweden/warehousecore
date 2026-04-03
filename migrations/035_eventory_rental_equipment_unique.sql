-- Add a unique index on (product_name, supplier_name) in rental_equipment.
-- This enables INSERT ... ON CONFLICT DO UPDATE (atomic upsert) for the
-- Eventory sync, and also prevents accidental duplicate rows.
--
-- Step 1: Remove duplicate rows, keeping the row with the highest equipment_id
-- (i.e. the most recently inserted). This makes the migration safe to apply
-- on existing databases that already contain duplicates.
DELETE FROM rental_equipment
WHERE equipment_id NOT IN (
    SELECT MAX(equipment_id)
    FROM rental_equipment
    GROUP BY product_name, supplier_name
);

-- Step 2: Add the unique index. If Step 1 ran cleanly, this will always succeed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_equipment_name_supplier
    ON rental_equipment (product_name, supplier_name);
