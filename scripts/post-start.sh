#!/bin/sh
# Post-start configuration for Jitsi containers.
# Run this ONCE after "docker compose up -d" completes.
set -e

echo "[1/3] Injecting nginx websocket config..."
docker cp "$(dirname "$0")/../websocket.conf" edtech-jitsi-web:/etc/nginx/conf.d/websocket.conf
docker exec edtech-jitsi-web nginx -s reload

echo "[2/3] Disabling AWS harvester in JVB..."
docker exec edtech-jitsi-jvb sh -c 'cat > /config/custom-jvb.conf << CONF
ice4j {
    harvest {
        mapping {
            aws {
                enabled = false
            }
        }
    }
}
CONF'
docker restart edtech-jitsi-jvb

echo "[3/3] Waiting for JVB to restart..."
sleep 5

echo "✅ Post-start configuration complete."
echo "   API:   http://localhost:8000/health"
echo "   Jitsi: https://localhost:8443"
echo "   Docs:  http://localhost:8000/docs"
