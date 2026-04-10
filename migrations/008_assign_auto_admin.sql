-- Migration 008: Auto-assign Admin Role to N. Thielmann
-- This migration automatically grants admin privileges to the user "N. Thielmann"

-- Find user "N. Thielmann" and assign admin role
-- Using CONCAT to build full name from first_name and last_name
-- Also trying username and email fields as fallback

SET @admin_role_id = (SELECT roleID FROM roles WHERE name = 'admin' LIMIT 1);
SET @wh_admin_role_id = (SELECT roleID FROM roles WHERE name = 'warehouse_admin' LIMIT 1);
SET @thielmann_user_id = (
  SELECT userID FROM users
  WHERE CONCAT(first_name, ' ', last_name) LIKE '%Thielmann%'
     OR username LIKE '%thielmann%'
     OR email LIKE '%thielmann%'
  LIMIT 1
);

-- Assign both admin and warehouse_admin roles if user exists
INSERT IGNORE INTO user_roles_wh (user_id, role_id)
SELECT @thielmann_user_id, @admin_role_id
WHERE @thielmann_user_id IS NOT NULL AND @admin_role_id IS NOT NULL;

INSERT IGNORE INTO user_roles_wh (user_id, role_id)
SELECT @thielmann_user_id, @wh_admin_role_id
WHERE @thielmann_user_id IS NOT NULL AND @wh_admin_role_id IS NOT NULL;

-- Log the result
SELECT
  CASE
    WHEN @thielmann_user_id IS NULL THEN 'WARNING: User "N. Thielmann" not found. Admin role not assigned.'
    WHEN @admin_role_id IS NULL THEN 'WARNING: Admin role not found in roles table.'
    ELSE CONCAT('SUCCESS: Admin role assigned to user ID ', @thielmann_user_id)
  END AS migration_status;
