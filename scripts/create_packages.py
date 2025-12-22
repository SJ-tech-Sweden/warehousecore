#!/usr/bin/env python3
"""
Script to create 14 product packages in WarehouseCore
"""

import requests
import json
import sys

# API Configuration
API_BASE_URL = "http://localhost:8082/api/v1"

# Product ID mapping from database
PRODUCT_MAP = {
    "ZLX 12P": 4,
    "Eurorack UB 2222 FX Pro": 1000006,
    "Battery Par Light": 31,
    "Pixelbar Switch Bat": 13,
    "SM58 LC": 17,
    "Stinger 12A G3": 2,
    "Stinger Sub 18A G3": 1,
    "X32": 5,
    "LED Movinghead E150 Spot": 10,
    "Thunderwash 600 RGBW": 48,
    "Vega Ambient Strobe": 49,
    "Daslight DVC Gold": 11,
    "AFH-600 DMX Hazer": 15,
    "Beta 58A Funk": 20,
    "Yamaha MG16": 37,
    "GLXD4": 26,
    "SM58 Funk": 18,
    "Gravity SS 5211 Speakerstand": 21,
    "K&M 26736 Distance Rod": 22,
    "K&M 27105 Mikrofonstativ": 28,
    "Millenium SLS300 Lightingstand": 12,
}

# Category for packages - using "Other" category
PACKAGE_CATEGORY_ID = 1005

# Package definitions
PACKAGES = [
    {
        "name": "Hochzeits-Paket \"Glow & Groove\"",
        "description": "Warmes Ambient-Light + sauberer Sound fuer Hochzeit/Party bis mittelgrosse Location - schnell aufgebaut, wirkt edel.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["ZLX 12P"], "quantity": 2},
            {"product_id": PRODUCT_MAP["Eurorack UB 2222 FX Pro"], "quantity": 1},
            {"product_id": PRODUCT_MAP["Battery Par Light"], "quantity": 8},
            {"product_id": PRODUCT_MAP["Pixelbar Switch Bat"], "quantity": 4},
            {"product_id": PRODUCT_MAP["SM58 LC"], "quantity": 1},
        ],
    },
    {
        "name": "Party-Paket \"Nightclub in a Box\"",
        "description": "Club-Feeling mit Bass, Showlicht, Strobe & Haze - fuer grosse Partys, Hallen, DJ-Events.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["Stinger 12A G3"], "quantity": 2},
            {"product_id": PRODUCT_MAP["Stinger Sub 18A G3"], "quantity": 4},
            {"product_id": PRODUCT_MAP["X32"], "quantity": 1},
            {"product_id": PRODUCT_MAP["LED Movinghead E150 Spot"], "quantity": 4},
            {"product_id": PRODUCT_MAP["Thunderwash 600 RGBW"], "quantity": 8},
            {"product_id": PRODUCT_MAP["Vega Ambient Strobe"], "quantity": 2},
            {"product_id": PRODUCT_MAP["Daslight DVC Gold"], "quantity": 1},
            {"product_id": PRODUCT_MAP["AFH-600 DMX Hazer"], "quantity": 1},
        ],
    },
    {
        "name": "Redner & Moderation \"ClearVoice\"",
        "description": "Sprachverstaendlichkeit first - ideal fuer Reden, Vereinsabende, Business-Events und Moderation.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["ZLX 12P"], "quantity": 2},
            {"product_id": PRODUCT_MAP["Yamaha MG16"], "quantity": 1},
            {"product_id": PRODUCT_MAP["Beta 58A Funk"], "quantity": 1},
            {"product_id": PRODUCT_MAP["SM58 LC"], "quantity": 1},
        ],
    },
]

# Variant packages for AmbientGlow (4 variants)
AMBIENT_GLOW_VARIANTS = [
    {"name": "Akku-Uplight Paket \"AmbientGlow 4\"", "description": "Dezente Raumfarbe, super schnell gestellt.", "quantity": 4},
    {"name": "Akku-Uplight Paket \"AmbientGlow 6\"", "description": "Mehr Flaeche/mehr Ecken, immer noch mobil.", "quantity": 6},
    {"name": "Akku-Uplight Paket \"AmbientGlow 8\"", "description": "Richtiges Ambiente fuer Hochzeit/Location.", "quantity": 8},
    {"name": "Akku-Uplight Paket \"AmbientGlow 12\"", "description": "Grosse Raeume/ganzer Saal, ordentlich Wirkung.", "quantity": 12},
]

for variant in AMBIENT_GLOW_VARIANTS:
    PACKAGES.append({
        "name": variant["name"],
        "description": variant["description"],
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["Battery Par Light"], "quantity": variant["quantity"]},
        ],
    })

# Variant packages for ColorWall (4 variants)
COLOR_WALL_VARIANTS = [
    {"name": "Washlight Paket \"ColorWall 4\"", "description": "Kleine Buehne / DJ-Booth Ausleuchtung.", "quantity": 4},
    {"name": "Washlight Paket \"ColorWall 6\"", "description": "Buehne + Background sauber ausgeleuchtet.", "quantity": 6},
    {"name": "Washlight Paket \"ColorWall 8\"", "description": "Sichtbar Show-Look, kraeftige Farben.", "quantity": 8},
    {"name": "Washlight Paket \"ColorWall 12\"", "description": "Grosse Buehne / breite Front, viel Punch.", "quantity": 12},
]

for variant in COLOR_WALL_VARIANTS:
    PACKAGES.append({
        "name": variant["name"],
        "description": variant["description"],
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["Thunderwash 600 RGBW"], "quantity": variant["quantity"]},
        ],
    })

# Additional light packages
PACKAGES.extend([
    {
        "name": "Movinghead-Show \"SpotAttack 4\"",
        "description": "Bewegtes Licht fuer Tanzflaeche/Buehne - perfekte Wow-Bewegung ohne riesigen Aufwand.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["LED Movinghead E150 Spot"], "quantity": 4},
            {"product_id": PRODUCT_MAP["Daslight DVC Gold"], "quantity": 1},
            {"product_id": PRODUCT_MAP["Millenium SLS300 Lightingstand"], "quantity": 1},
        ],
    },
    {
        "name": "Strobe-Add-on \"Impact Duo\"",
        "description": "Maximaler Impact fuer Drops/Highlights - macht aus Party direkt Club-Moment.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["Vega Ambient Strobe"], "quantity": 2},
        ],
    },
    {
        "name": "Hazer-Add-on \"Atmosphere\"",
        "description": "Macht Lichtstrahlen sichtbar und erhoeht den Pro-Look sofort (gerade bei Movingheads).",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["AFH-600 DMX Hazer"], "quantity": 1},
        ],
    },
])

# Sound packages
PACKAGES.extend([
    {
        "name": "Budget-PA \"SoloSpeech\"",
        "description": "Guenstige eine Box-Loesung fuer Sprache/kleine Hintergrundmusik - perfekt fuer Nebenraeume, Sektempfang, kleine Vereinsrunden.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["ZLX 12P"], "quantity": 1},
            {"product_id": PRODUCT_MAP["Gravity SS 5211 Speakerstand"], "quantity": 1},
            {"product_id": PRODUCT_MAP["SM58 LC"], "quantity": 1},
        ],
    },
    {
        "name": "Budget-PA \"Duo Basic\"",
        "description": "Preiswerter Stereo-Sound fuer kleine Feiern - unkompliziert, laut genug, schnell aufgebaut.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["ZLX 12P"], "quantity": 2},
            {"product_id": PRODUCT_MAP["Gravity SS 5211 Speakerstand"], "quantity": 2},
        ],
    },
    {
        "name": "DJ-Budget \"BassBuddy 1x18\"",
        "description": "Fuer kleines Geld spuerbarer Bass - ideal fuer Geburtstage/kleinere Partys, wenn ein Sub reicht.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["Stinger 12A G3"], "quantity": 2},
            {"product_id": PRODUCT_MAP["Stinger Sub 18A G3"], "quantity": 1},
        ],
    },
    {
        "name": "DJ-Setup \"BassDuo 2x18\"",
        "description": "Der Sweet-Spot aus Druck & Preis - deutlich mehr Headroom fuer Tanzflaeche, ohne Full-Club-Setup.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["Stinger 12A G3"], "quantity": 2},
            {"product_id": PRODUCT_MAP["Stinger Sub 18A G3"], "quantity": 2},
        ],
    },
    {
        "name": "Mikrofon-Add-on \"FunkVocal\"",
        "description": "Drahtlos singen/sprechen ohne Stress - super als Upgrade fuer DJ/Moderation.",
        "category_id": PACKAGE_CATEGORY_ID,
        "website_visible": True,
        "items": [
            {"product_id": PRODUCT_MAP["GLXD4"], "quantity": 1},
            {"product_id": PRODUCT_MAP["SM58 Funk"], "quantity": 1},
        ],
    },
])

# Accessories package
PACKAGES.append({
    "name": "StageKit \"Stative & Rods\"",
    "description": "Alles, was man drumherum braucht - stabil, sauber, professioneller Look beim Aufbau.",
    "category_id": PACKAGE_CATEGORY_ID,
    "website_visible": True,
    "items": [
        {"product_id": PRODUCT_MAP["Gravity SS 5211 Speakerstand"], "quantity": 2},
        {"product_id": PRODUCT_MAP["K&M 26736 Distance Rod"], "quantity": 2},
        {"product_id": PRODUCT_MAP["K&M 27105 Mikrofonstativ"], "quantity": 2},
    ],
})


def create_package(package_data):
    """Create a package via the WarehouseCore API"""
    url = f"{API_BASE_URL}/admin/product-packages"

    print(f"\nCreating package: {package_data['name']}")
    print(f"  Description: {package_data['description'][:80]}...")
    print(f"  Items: {len(package_data['items'])} products")

    try:
        response = requests.post(url, json=package_data, timeout=10)

        if response.status_code == 201:
            result = response.json()
            print(f"  Success! Package ID: {result.get('package_id')}, Code: {result.get('package_code')}")
            return True, result
        else:
            print(f"  Failed: {response.status_code} - {response.text}")
            return False, response.text

    except Exception as e:
        print(f"  Error: {str(e)}")
        return False, str(e)


def main():
    """Main function to create all packages"""
    print(f"Creating {len(PACKAGES)} product packages...")
    print(f"API Base URL: {API_BASE_URL}")
    print("=" * 80)

    successful = []
    failed = []

    for i, package in enumerate(PACKAGES, 1):
        print(f"\n[{i}/{len(PACKAGES)}]")
        success, result = create_package(package)

        if success:
            successful.append((package['name'], result))
        else:
            failed.append((package['name'], result))

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total packages: {len(PACKAGES)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")

    if successful:
        print("\nSuccessfully created packages:")
        for name, result in successful:
            pkg_id = result.get('package_id', 'N/A')
            pkg_code = result.get('package_code', 'N/A')
            print(f"  - {name} (ID: {pkg_id}, Code: {pkg_code})")

    if failed:
        print("\nFailed packages:")
        for name, error in failed:
            print(f"  - {name}")
            print(f"    Error: {str(error)[:100]}")

    return 0 if len(failed) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
