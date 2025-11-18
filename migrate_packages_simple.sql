-- ========================================
-- Simple Migration: Link Packages to Products
-- ========================================

START TRANSACTION;

-- Create Products for existing packages (if not already exist)
INSERT IGNORE INTO products (productID, name, categoryID, itemcostperday, description)
VALUES
  (70, 'Sound L', 1001, 200.00, '2x Subwoofer 18"\n2x Lautsprecher 12"\n1x Analoges Mischpult\n1x Notebook für Musik'),
  (71, 'Ambientebeleuchtung', 1002, 100.00, '12x Akkuscheinwerfer'),
  (72, 'Effectlight M', 1004, 150.00, '2 Stative mit jeweils 2x 150W LED Movingheads');

-- Link packages to their products
UPDATE product_packages SET product_id = 70 WHERE package_id = 1 AND product_id IS NULL;
UPDATE product_packages SET product_id = 71 WHERE package_id = 2 AND product_id IS NULL;
UPDATE product_packages SET product_id = 72 WHERE package_id = 3 AND product_id IS NULL;

-- Verify
SELECT
    pp.package_id,
    pp.package_code,
    pp.name as package_name,
    pp.product_id,
    p.name as product_name,
    p.categoryID,
    c.name as category,
    p.itemcostperday
FROM product_packages pp
LEFT JOIN products p ON pp.product_id = p.productID
LEFT JOIN categories c ON p.categoryID = c.categoryID;

COMMIT;
SELECT '✅ Migration completed' AS status;
