-- Migration 040: Assign admin and warehouse_admin roles to N. Thielmann
--
-- This is a corrected follow-up to migration 008.  Migration 008 is kept
-- immutable so that environments that have already applied it are not affected
-- by edits to that file.
--
-- Improvements over 008:
--   1. A single PL/pgSQL block counts matching users first and aborts with
--      RAISE EXCEPTION if more than one matches, so roles are never granted to
--      the wrong account.
--   2. Raises a NOTICE when no user is found (safe no-op).
--   3. Returns early with a WARNING when neither required role exists.
--   4. Reports the actual number of inserted rows (GET DIAGNOSTICS ROW_COUNT).
--   5. Idempotent: ON CONFLICT (userid, roleid) DO NOTHING.
--
-- Safe to re-run on any environment where the target user is unique.

DO $$
DECLARE
  target_userid BIGINT;
  user_count     INT;
  role_count     INT;
BEGIN
  -- Count how many users match the pattern to guard against ambiguity.
  SELECT COUNT(*) INTO user_count
  FROM users u
  WHERE (
    (COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) ILIKE '%thielmann%'
    OR u.username ILIKE '%thielmann%'
    OR u.email    ILIKE '%thielmann%'
  );

  IF user_count = 0 THEN
    RAISE NOTICE 'Migration 040: no user matching thielmann found; skipping role grants.';
    RETURN;
  END IF;

  IF user_count <> 1 THEN
    RAISE EXCEPTION 'Migration 040: expected exactly 1 user matching thielmann, found %; '
                    'aborting to avoid granting roles to the wrong account.', user_count;
  END IF;

  SELECT u.userid INTO target_userid
  FROM users u
  WHERE (
    (COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) ILIKE '%thielmann%'
    OR u.username ILIKE '%thielmann%'
    OR u.email    ILIKE '%thielmann%'
  );

  -- Verify that both required roles exist before inserting.
  SELECT COUNT(*) INTO role_count
  FROM roles
  WHERE name IN ('admin', 'warehouse_admin');

  IF role_count = 0 THEN
    RAISE WARNING 'Migration 040: neither admin nor warehouse_admin role found; skipping grants.';
    RETURN;
  END IF;

  IF role_count < 2 THEN
    RAISE WARNING 'Migration 040: expected 2 roles (admin, warehouse_admin) but found %; '
                  'grant may be incomplete for userid %.', role_count, target_userid;
  END IF;

  INSERT INTO user_roles (userid, roleid, assigned_at, is_active)
  SELECT target_userid, r.roleid, NOW(), TRUE
  FROM roles r
  WHERE r.name IN ('admin', 'warehouse_admin')
  ON CONFLICT (userid, roleid) DO NOTHING;

  GET DIAGNOSTICS role_count = ROW_COUNT;
  RAISE NOTICE 'Migration 040: % role(s) granted/confirmed for userid %.', role_count, target_userid;
END;
$$;
