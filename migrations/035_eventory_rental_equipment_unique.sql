-- Add a unique index on (product_name, supplier_name) in rental_equipment.
-- This enables INSERT ... ON CONFLICT DO UPDATE (atomic upsert) for the
-- Eventory sync, and also prevents accidental duplicate rows.
--
-- Step 1: Remove duplicate rows, keeping the row with the highest equipment_id
-- (i.e. the most recently inserted). Uses ROW_NUMBER() to avoid a full-table
-- scan in the subquery, making it safe to run even on large datasets.
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

-- Step 2: Add the unique index. If Step 1 ran cleanly, this will always succeed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_equipment_name_supplier
    ON rental_equipment (product_name, supplier_name);
