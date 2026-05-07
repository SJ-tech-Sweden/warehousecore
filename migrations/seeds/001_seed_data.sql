-- warehousecore seed data (idempotent)
BEGIN;

CREATE TABLE IF NOT EXISTS public.seed_marker (name text PRIMARY KEY, applied_at timestamptz DEFAULT now());
INSERT INTO public.seed_marker (name) VALUES ('initial_seed') ON CONFLICT DO NOTHING;

-- API key for inter-service calls (handle schema variants: `api_key_hash` or legacy `key_hash`)
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'api_key_hash') THEN
		EXECUTE $q$
			INSERT INTO api_keys (id, name, api_key_hash, created_at)
			VALUES (1, 'rentalcore-internal', md5('rentalcore-internal-key'), NOW())
			ON CONFLICT DO NOTHING;
		$q$;
	ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'key_hash') THEN
		EXECUTE $q$
			INSERT INTO api_keys (id, name, key_hash, created_at)
			VALUES (1, 'rentalcore-internal', md5('rentalcore-internal-key'), NOW())
			ON CONFLICT DO NOTHING;
		$q$;
	ELSE
		RAISE NOTICE 'Skipping api_keys seed: no recognized hash column present';
	END IF;
END$$;

-- Products (handle optional `created_at` column)
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'created_at') THEN
		EXECUTE $q$
			INSERT INTO products (productID, name, created_at)
			VALUES (1, 'Widget A', NOW()) ON CONFLICT DO NOTHING;
			INSERT INTO products (productID, name, created_at)
			VALUES (2, 'Cable 1m', NOW()) ON CONFLICT DO NOTHING;
		$q$;
	ELSE
		EXECUTE $q$
			INSERT INTO products (productID, name)
			VALUES (1, 'Widget A') ON CONFLICT DO NOTHING;
			INSERT INTO products (productID, name)
			VALUES (2, 'Cable 1m') ON CONFLICT DO NOTHING;
		$q$;
	END IF;
END$$;

-- Devices / Zones
INSERT INTO zones (id, name) VALUES (1, 'Main Warehouse') ON CONFLICT DO NOTHING;
-- Insert device, handle optional `created_at` column
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'created_at') THEN
		EXECUTE $q$
			INSERT INTO devices (deviceID, serialnumber, productID, zone_id, created_at)
			VALUES ('DEV-0001', 'DEV-0001', 1, 1, NOW()) ON CONFLICT DO NOTHING;
		$q$;
	ELSE
		EXECUTE $q$
			INSERT INTO devices (deviceID, serialnumber, productID, zone_id)
			VALUES ('DEV-0001', 'DEV-0001', 1, 1) ON CONFLICT DO NOTHING;
		$q$;
	END IF;
END$$;

COMMIT;
