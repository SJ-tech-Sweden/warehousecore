#!/usr/bin/env python3
"""
MQTT Retained Message Cleanup Script

This script removes all retained heartbeat messages from the MQTT broker.
Old ESP32 controllers that no longer exist can leave retained messages
that get re-delivered on every server restart.

Usage:
    python3 cleanup_mqtt_retained.py

Environment Variables:
    MQTT_HOST: MQTT broker host (default: localhost)
    MQTT_PORT: MQTT broker port (default: 1883)
    MQTT_USER: MQTT username (default: leduser)
    MQTT_PASS: MQTT password (default: ledpassword123)
    TOPIC_PREFIX: MQTT topic prefix (default: weidelbach)
"""

import os
import sys
import time
import paho.mqtt.client as mqtt

# Configuration from environment
MQTT_HOST = os.getenv('MQTT_HOST', 'localhost')
MQTT_PORT = int(os.getenv('MQTT_PORT', '1883'))
MQTT_USER = os.getenv('MQTT_USER', 'leduser')
MQTT_PASS = os.getenv('MQTT_PASS', 'ledpassword123')
TOPIC_PREFIX = os.getenv('TOPIC_PREFIX', 'weidelbach')

# Track discovered topics
discovered_topics = set()
cleanup_complete = False


def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        print(f"✓ Connected to MQTT broker at {MQTT_HOST}:{MQTT_PORT}")
        # Subscribe to all status topics with wildcard
        topic = f"{TOPIC_PREFIX}/+/status"
        client.subscribe(topic)
        print(f"📡 Subscribed to: {topic}")
        print("🔍 Listening for retained messages (5 seconds)...")
    else:
        print(f"✗ Connection failed with code {rc}")
        sys.exit(1)


def on_message(client, userdata, msg):
    """Callback when a message is received"""
    global discovered_topics

    # Only process retained messages
    if msg.retain:
        topic = msg.topic
        if topic not in discovered_topics:
            discovered_topics.add(topic)
            print(f"  Found retained message: {topic}")


def cleanup_retained_messages(client):
    """Send empty retained messages to clear them from broker"""
    global cleanup_complete

    if not discovered_topics:
        print("\n✓ No retained messages found!")
        cleanup_complete = True
        return

    print(f"\n🧹 Cleaning up {len(discovered_topics)} retained message(s)...")

    for topic in discovered_topics:
        # Publish empty message with retain=True to delete the retained message
        result = client.publish(topic, payload=None, qos=1, retain=True)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"  ✓ Cleared: {topic}")
        else:
            print(f"  ✗ Failed to clear: {topic}")

    print(f"\n✅ Cleanup complete! Removed {len(discovered_topics)} retained message(s).")
    cleanup_complete = True


def main():
    """Main cleanup routine"""
    global cleanup_complete

    print("=" * 60)
    print("MQTT Retained Message Cleanup")
    print("=" * 60)
    print(f"Broker: {MQTT_HOST}:{MQTT_PORT}")
    print(f"Topic:  {TOPIC_PREFIX}/+/status")
    print("=" * 60)

    # Create MQTT client
    client = mqtt.Client(client_id="cleanup_script")
    client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        # Connect to broker
        client.connect(MQTT_HOST, MQTT_PORT, 60)

        # Start loop in background
        client.loop_start()

        # Wait 5 seconds to collect all retained messages
        time.sleep(5)

        # Cleanup retained messages
        cleanup_retained_messages(client)

        # Wait a moment for cleanup to complete
        time.sleep(1)

        # Stop loop and disconnect
        client.loop_stop()
        client.disconnect()

        print("\n✓ Script completed successfully!")
        return 0

    except Exception as e:
        print(f"\n✗ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
