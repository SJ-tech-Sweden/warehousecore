-- Script to create 14 product packages in WarehouseCore
-- This script creates packages with their associated product entries and items

BEGIN;

-- Package 1: Hochzeits-Paket "Glow & Groove"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Hochzeits-Paket "Glow & Groove"', 1005, NULL, 'Warmes Ambient-Light + sauberer Sound fuer Hochzeit/Party bis mittelgrosse Location - schnell aufgebaut, wirkt edel.', true)
RETURNING productID;

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Hochzeits-Paket "Glow & Groove"'),
        'Hochzeits-Paket "Glow & Groove"',
        'Warmes Ambient-Light + sauberer Sound fuer Hochzeit/Party bis mittelgrosse Location - schnell aufgebaut, wirkt edel.',
        NULL, true)
RETURNING package_id;

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Hochzeits-Paket "Glow & Groove"'), 4, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'Hochzeits-Paket "Glow & Groove"'), 1000006, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Hochzeits-Paket "Glow & Groove"'), 31, 8),
    ((SELECT package_id FROM product_packages WHERE name = 'Hochzeits-Paket "Glow & Groove"'), 13, 4),
    ((SELECT package_id FROM product_packages WHERE name = 'Hochzeits-Paket "Glow & Groove"'), 17, 1);

-- Package 2: Party-Paket "Nightclub in a Box"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Party-Paket "Nightclub in a Box"', 1005, NULL, 'Club-Feeling mit Bass, Showlicht, Strobe & Haze - fuer grosse Partys, Hallen, DJ-Events.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Party-Paket "Nightclub in a Box"'),
        'Party-Paket "Nightclub in a Box"',
        'Club-Feeling mit Bass, Showlicht, Strobe & Haze - fuer grosse Partys, Hallen, DJ-Events.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Party-Paket "Nightclub in a Box"'), 2, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'Party-Paket "Nightclub in a Box"'), 1, 4),
    ((SELECT package_id FROM product_packages WHERE name = 'Party-Paket "Nightclub in a Box"'), 5, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Party-Paket "Nightclub in a Box"'), 10, 4),
    ((SELECT package_id FROM product_packages WHERE name = 'Party-Paket "Nightclub in a Box"'), 48, 8),
    ((SELECT package_id FROM product_packages WHERE name = 'Party-Paket "Nightclub in a Box"'), 49, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'Party-Paket "Nightclub in a Box"'), 11, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Party-Paket "Nightclub in a Box"'), 15, 1);

-- Package 3: Redner & Moderation "ClearVoice"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Redner & Moderation "ClearVoice"', 1005, NULL, 'Sprachverstaendlichkeit first - ideal fuer Reden, Vereinsabende, Business-Events und Moderation.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Redner & Moderation "ClearVoice"'),
        'Redner & Moderation "ClearVoice"',
        'Sprachverstaendlichkeit first - ideal fuer Reden, Vereinsabende, Business-Events und Moderation.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Redner & Moderation "ClearVoice"'), 4, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'Redner & Moderation "ClearVoice"'), 37, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Redner & Moderation "ClearVoice"'), 20, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Redner & Moderation "ClearVoice"'), 17, 1);

-- Package 4-7: AmbientGlow variants (4, 6, 8, 12)
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES
    ('Akku-Uplight Paket "AmbientGlow 4"', 1005, NULL, 'Dezente Raumfarbe, super schnell gestellt.', true),
    ('Akku-Uplight Paket "AmbientGlow 6"', 1005, NULL, 'Mehr Flaeche/mehr Ecken, immer noch mobil.', true),
    ('Akku-Uplight Paket "AmbientGlow 8"', 1005, NULL, 'Richtiges Ambiente fuer Hochzeit/Location.', true),
    ('Akku-Uplight Paket "AmbientGlow 12"', 1005, NULL, 'Grosse Raeume/ganzer Saal, ordentlich Wirkung.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
SELECT
    'PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
    p.productID,
    p.name,
    p.description,
    NULL,
    true
FROM products p
WHERE p.name IN (
    'Akku-Uplight Paket "AmbientGlow 4"',
    'Akku-Uplight Paket "AmbientGlow 6"',
    'Akku-Uplight Paket "AmbientGlow 8"',
    'Akku-Uplight Paket "AmbientGlow 12"'
);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Akku-Uplight Paket "AmbientGlow 4"'), 31, 4),
    ((SELECT package_id FROM product_packages WHERE name = 'Akku-Uplight Paket "AmbientGlow 6"'), 31, 6),
    ((SELECT package_id FROM product_packages WHERE name = 'Akku-Uplight Paket "AmbientGlow 8"'), 31, 8),
    ((SELECT package_id FROM product_packages WHERE name = 'Akku-Uplight Paket "AmbientGlow 12"'), 31, 12);

-- Package 8-11: ColorWall variants (4, 6, 8, 12)
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES
    ('Washlight Paket "ColorWall 4"', 1005, NULL, 'Kleine Buehne / DJ-Booth Ausleuchtung.', true),
    ('Washlight Paket "ColorWall 6"', 1005, NULL, 'Buehne + Background sauber ausgeleuchtet.', true),
    ('Washlight Paket "ColorWall 8"', 1005, NULL, 'Sichtbar Show-Look, kraeftige Farben.', true),
    ('Washlight Paket "ColorWall 12"', 1005, NULL, 'Grosse Buehne / breite Front, viel Punch.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
SELECT
    'PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
    p.productID,
    p.name,
    p.description,
    NULL,
    true
FROM products p
WHERE p.name IN (
    'Washlight Paket "ColorWall 4"',
    'Washlight Paket "ColorWall 6"',
    'Washlight Paket "ColorWall 8"',
    'Washlight Paket "ColorWall 12"'
);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Washlight Paket "ColorWall 4"'), 48, 4),
    ((SELECT package_id FROM product_packages WHERE name = 'Washlight Paket "ColorWall 6"'), 48, 6),
    ((SELECT package_id FROM product_packages WHERE name = 'Washlight Paket "ColorWall 8"'), 48, 8),
    ((SELECT package_id FROM product_packages WHERE name = 'Washlight Paket "ColorWall 12"'), 48, 12);

-- Package 12: Movinghead-Show "SpotAttack 4"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Movinghead-Show "SpotAttack 4"', 1005, NULL, 'Bewegtes Licht fuer Tanzflaeche/Buehne - perfekte Wow-Bewegung ohne riesigen Aufwand.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Movinghead-Show "SpotAttack 4"'),
        'Movinghead-Show "SpotAttack 4"',
        'Bewegtes Licht fuer Tanzflaeche/Buehne - perfekte Wow-Bewegung ohne riesigen Aufwand.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Movinghead-Show "SpotAttack 4"'), 10, 4),
    ((SELECT package_id FROM product_packages WHERE name = 'Movinghead-Show "SpotAttack 4"'), 11, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Movinghead-Show "SpotAttack 4"'), 12, 1);

-- Package 13: Strobe-Add-on "Impact Duo"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Strobe-Add-on "Impact Duo"', 1005, NULL, 'Maximaler Impact fuer Drops/Highlights - macht aus Party direkt Club-Moment.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Strobe-Add-on "Impact Duo"'),
        'Strobe-Add-on "Impact Duo"',
        'Maximaler Impact fuer Drops/Highlights - macht aus Party direkt Club-Moment.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Strobe-Add-on "Impact Duo"'), 49, 2);

-- Package 14: Hazer-Add-on "Atmosphere"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Hazer-Add-on "Atmosphere"', 1005, NULL, 'Macht Lichtstrahlen sichtbar und erhoeht den Pro-Look sofort (gerade bei Movingheads).', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Hazer-Add-on "Atmosphere"'),
        'Hazer-Add-on "Atmosphere"',
        'Macht Lichtstrahlen sichtbar und erhoeht den Pro-Look sofort (gerade bei Movingheads).',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Hazer-Add-on "Atmosphere"'), 15, 1);

-- Package 15: Budget-PA "SoloSpeech"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Budget-PA "SoloSpeech"', 1005, NULL, 'Guenstige eine Box-Loesung fuer Sprache/kleine Hintergrundmusik - perfekt fuer Nebenraeume, Sektempfang, kleine Vereinsrunden.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Budget-PA "SoloSpeech"'),
        'Budget-PA "SoloSpeech"',
        'Guenstige eine Box-Loesung fuer Sprache/kleine Hintergrundmusik - perfekt fuer Nebenraeume, Sektempfang, kleine Vereinsrunden.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Budget-PA "SoloSpeech"'), 4, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Budget-PA "SoloSpeech"'), 21, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Budget-PA "SoloSpeech"'), 17, 1);

-- Package 16: Budget-PA "Duo Basic"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Budget-PA "Duo Basic"', 1005, NULL, 'Preiswerter Stereo-Sound fuer kleine Feiern - unkompliziert, laut genug, schnell aufgebaut.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Budget-PA "Duo Basic"'),
        'Budget-PA "Duo Basic"',
        'Preiswerter Stereo-Sound fuer kleine Feiern - unkompliziert, laut genug, schnell aufgebaut.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Budget-PA "Duo Basic"'), 4, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'Budget-PA "Duo Basic"'), 21, 2);

-- Package 17: DJ-Budget "BassBuddy 1x18"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('DJ-Budget "BassBuddy 1x18"', 1005, NULL, 'Fuer kleines Geld spuerbarer Bass - ideal fuer Geburtstage/kleinere Partys, wenn ein Sub reicht.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'DJ-Budget "BassBuddy 1x18"'),
        'DJ-Budget "BassBuddy 1x18"',
        'Fuer kleines Geld spuerbarer Bass - ideal fuer Geburtstage/kleinere Partys, wenn ein Sub reicht.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'DJ-Budget "BassBuddy 1x18"'), 2, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'DJ-Budget "BassBuddy 1x18"'), 1, 1);

-- Package 18: DJ-Setup "BassDuo 2x18"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('DJ-Setup "BassDuo 2x18"', 1005, NULL, 'Der Sweet-Spot aus Druck & Preis - deutlich mehr Headroom fuer Tanzflaeche, ohne Full-Club-Setup.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'DJ-Setup "BassDuo 2x18"'),
        'DJ-Setup "BassDuo 2x18"',
        'Der Sweet-Spot aus Druck & Preis - deutlich mehr Headroom fuer Tanzflaeche, ohne Full-Club-Setup.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'DJ-Setup "BassDuo 2x18"'), 2, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'DJ-Setup "BassDuo 2x18"'), 1, 2);

-- Package 19: Mikrofon-Add-on "FunkVocal"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('Mikrofon-Add-on "FunkVocal"', 1005, NULL, 'Drahtlos singen/sprechen ohne Stress - super als Upgrade fuer DJ/Moderation.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'Mikrofon-Add-on "FunkVocal"'),
        'Mikrofon-Add-on "FunkVocal"',
        'Drahtlos singen/sprechen ohne Stress - super als Upgrade fuer DJ/Moderation.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'Mikrofon-Add-on "FunkVocal"'), 26, 1),
    ((SELECT package_id FROM product_packages WHERE name = 'Mikrofon-Add-on "FunkVocal"'), 18, 1);

-- Package 20: StageKit "Stative & Rods"
INSERT INTO products (name, categoryID, itemcostperday, description, website_visible)
VALUES ('StageKit "Stative & Rods"', 1005, NULL, 'Alles, was man drumherum braucht - stabil, sauber, professioneller Look beim Aufbau.', true);

INSERT INTO product_packages (package_code, product_id, name, description, price, website_visible)
VALUES ('PKG-' || LPAD(CAST(NEXTVAL('product_packages_package_id_seq') AS TEXT), 6, '0'),
        (SELECT productID FROM products WHERE name = 'StageKit "Stative & Rods"'),
        'StageKit "Stative & Rods"',
        'Alles, was man drumherum braucht - stabil, sauber, professioneller Look beim Aufbau.',
        NULL, true);

INSERT INTO product_package_items (package_id, product_id, quantity)
VALUES
    ((SELECT package_id FROM product_packages WHERE name = 'StageKit "Stative & Rods"'), 21, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'StageKit "Stative & Rods"'), 22, 2),
    ((SELECT package_id FROM product_packages WHERE name = 'StageKit "Stative & Rods"'), 28, 2);

COMMIT;

-- Verification query
SELECT
    pp.package_id,
    pp.package_code,
    pp.name,
    COUNT(ppi.package_item_id) as item_count
FROM product_packages pp
LEFT JOIN product_package_items ppi ON pp.package_id = ppi.package_id
WHERE pp.name LIKE '%Paket%' OR pp.name LIKE '%Add-on%' OR pp.name LIKE '%Kit%' OR pp.name LIKE '%Setup%' OR pp.name LIKE '%Budget%'
GROUP BY pp.package_id, pp.package_code, pp.name
ORDER BY pp.package_id;
