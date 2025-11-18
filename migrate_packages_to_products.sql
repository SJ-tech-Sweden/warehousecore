-- ========================================
-- Migration: Packages as Products
-- Makes packages real products with categories
-- ========================================

START TRANSACTION;

-- Step 1: Add product_id column to product_packages (if not exists)
-- Check and add column only if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = 'RentalCore'
                   AND TABLE_NAME = 'product_packages'
                   AND COLUMN_NAME = 'product_id');

SET @sql = IF(@col_exists = 0,
              'ALTER TABLE product_packages ADD COLUMN product_id INT NULL AFTER package_id, ADD KEY idx_product_id (product_id)',
              'SELECT "Column product_id already exists" AS status');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Create Products for existing packages
-- Package 1: Sound L (package_id=1) - Sound category
INSERT INTO products (productID, name, categoryID, subcategoryID, itemcostperday, description)
VALUES (70, 'Sound L', 1001, NULL, 200.00, '2x Subwoofer 18"\n2x Lautsprecher 12"\n1x Analoges Mischpult\n1x Notebook für Musik');

-- Package 2: Ambientebeleuchtung (package_id=2) - Light category
INSERT INTO products (productID, name, categoryID, subcategoryID, itemcostperday, description)
VALUES (71, 'Ambientebeleuchtung', 1002, NULL, 100.00, '12x Akkuscheinwerfer');

-- Package 3: Effectlight M (package_id=3) - Effect category
INSERT INTO products (productID, name, categoryID, subcategoryID, itemcostperday, description)
VALUES (72, 'Effectlight M', 1004, NULL, 150.00, '2 Stative mit jeweils 2x 150W LED Movingheads');

-- Step 3: Link packages to their products
UPDATE product_packages SET product_id = 70 WHERE package_id = 1;
UPDATE product_packages SET product_id = 71 WHERE package_id = 2;
UPDATE product_packages SET product_id = 72 WHERE package_id = 3;

-- Step 4: Make product_id NOT NULL after data migration
ALTER TABLE product_packages MODIFY COLUMN product_id INT NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE product_packages
ADD CONSTRAINT fk_package_product
FOREIGN KEY (product_id) REFERENCES products(productID) ON DELETE CASCADE;

-- Verify migration
SELECT
    pp.package_id,
    pp.package_code,
    pp.name as package_name,
    pp.product_id,
    p.name as product_name,
    p.categoryID,
    p.itemcostperday
FROM product_packages pp
LEFT JOIN products p ON pp.product_id = p.productID;

COMMIT;
SELECT '✅ MIGRATION COMPLETED - Packages are now linked to Products' AS status;
