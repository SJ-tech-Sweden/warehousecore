#!/bin/bash
#
# MQTT Retained Message Cleanup Script
#
# This script removes all retained heartbeat messages from the MQTT broker.
# Old ESP32 controllers that no longer exist can leave retained messages
# that get re-delivered on every server restart.
#
# Usage:
#     ./cleanup_mqtt_retained.sh
#
# Environment Variables:
#     MQTT_HOST: MQTT broker host (default: localhost)
#     MQTT_PORT: MQTT broker port (default: 1883)
#     MQTT_USER: MQTT username (default: leduser)
#     MQTT_PASS: MQTT password (default: ledpassword123)
#     TOPIC_PREFIX: MQTT topic prefix (default: weidelbach)

set -e

# Configuration
MQTT_HOST="${MQTT_HOST:-localhost}"
MQTT_PORT="${MQTT_PORT:-1883}"
MQTT_USER="${MQTT_USER:-leduser}"
MQTT_PASS="${MQTT_PASS:-ledpassword123}"
TOPIC_PREFIX="${TOPIC_PREFIX:-weidelbach}"

echo "============================================================"
echo "MQTT Retained Message Cleanup"
echo "============================================================"
echo "Broker: $MQTT_HOST:$MQTT_PORT"
echo "Topic:  $TOPIC_PREFIX/+/status"
echo "============================================================"
echo ""

# Create temp file for discovered topics
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

echo "🔍 Scanning for retained messages (timeout: 5 seconds)..."
echo ""

# Subscribe to all status topics and capture only retained messages for 5 seconds
# The -R flag only shows retained messages
# The -W flag sets a timeout
timeout 5s mosquitto_sub \
    -h "$MQTT_HOST" \
    -p "$MQTT_PORT" \
    -u "$MQTT_USER" \
    -P "$MQTT_PASS" \
    -t "$TOPIC_PREFIX/+/status" \
    -v \
    -R 2>/dev/null | while read -r line; do
        # Extract topic from "topic message" format
        topic=$(echo "$line" | cut -d' ' -f1)
        echo "  Found retained: $topic"
        echo "$topic" >> "$TEMP_FILE"
    done || true

# Count discovered topics
if [ -f "$TEMP_FILE" ]; then
    TOPIC_COUNT=$(wc -l < "$TEMP_FILE" 2>/dev/null || echo "0")
else
    TOPIC_COUNT=0
fi

echo ""
if [ "$TOPIC_COUNT" -eq 0 ]; then
    echo "✓ No retained messages found!"
    exit 0
fi

echo "🧹 Cleaning up $TOPIC_COUNT retained message(s)..."
echo ""

# Clear each retained message by publishing empty payload with retain flag
while IFS= read -r topic; do
    if [ -n "$topic" ]; then
        mosquitto_pub \
            -h "$MQTT_HOST" \
            -p "$MQTT_PORT" \
            -u "$MQTT_USER" \
            -P "$MQTT_PASS" \
            -t "$topic" \
            -n \
            -r \
            2>/dev/null && echo "  ✓ Cleared: $topic" || echo "  ✗ Failed: $topic"
    fi
done < "$TEMP_FILE"

echo ""
echo "✅ Cleanup complete! Removed $TOPIC_COUNT retained message(s)."
echo ""
echo "Note: You should now update ESP32 firmware to v1.5.1 to prevent"
echo "      future retained messages from being created."
