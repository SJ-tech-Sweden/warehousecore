# Utility Scripts

## MQTT Retained Message Cleanup

### Problem
ESP32 controllers were sending heartbeats with the MQTT `retained=true` flag, which caused old controller data to remain stored in the MQTT broker and be delivered repeatedly, even when the ESPs had long been offline.

### Quick Fix

**On the server with the MQTT broker:**

```bash
cd /opt/dev/cores/warehousecore
./scripts/cleanup_mqtt_retained.sh
```

**With Docker Compose (when MQTT runs in Docker):**

```bash
# Use credentials from .env or docker-compose.yml
export MQTT_USER="leduser"
export MQTT_PASS="ledpassword123"
export MQTT_HOST="localhost"
export TOPIC_PREFIX="weidelbach"

./scripts/cleanup_mqtt_retained.sh
```

**Directly in the mosquitto container:**

```bash
docker exec -it mosquitto sh -c 'timeout 5 mosquitto_sub -h localhost -u leduser -P ledpassword123 -t "weidelbach/+/status" -v -R | while read topic msg; do mosquitto_pub -h localhost -u leduser -P ledpassword123 -t "$topic" -n -r; echo "Cleared: $topic"; done || true'
```

### Available Scripts

| Script | Description | Prerequisites |
|--------|-------------|---------------|
| `cleanup_mqtt_retained.sh` | Bash-based cleanup | `mosquitto_sub`, `mosquitto_pub` |
| `cleanup_mqtt_retained.py` | Python-based cleanup | Python 3, `paho-mqtt` |

### After Cleanup

1. **Update ESP32 firmware** to v1.5.1 or newer
2. **Check admin dashboard** - only active controllers should be visible
3. Use the **"Delete Offline"** button to remove any remaining stale entries

### Verification

Check whether retained messages are still present:

```bash
timeout 10s mosquitto_sub -h localhost -u leduser -P ledpassword123 -t 'weidelbach/+/status' -v -R
```

No output = Success! ✅

### Technical Details

See [MQTT_RETAINED_FIX.md](../MQTT_RETAINED_FIX.md) for a detailed explanation of the problem and the solution.
