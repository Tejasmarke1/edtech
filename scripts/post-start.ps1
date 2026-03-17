# Post-start configuration for Jitsi containers.
# Run this ONCE after "docker compose up -d" completes.

Write-Host "[1/3] Injecting nginx websocket config..."
docker cp "$PSScriptRoot\..\websocket.conf" edtech-jitsi-web:/etc/nginx/conf.d/websocket.conf
docker exec edtech-jitsi-web nginx -s reload

Write-Host "[2/3] Disabling AWS harvester in JVB..."
docker exec edtech-jitsi-jvb sh -c @'
cat > /config/custom-jvb.conf << CONF
ice4j {
    harvest {
        mapping {
            aws {
                enabled = false
            }
        }
    }
}
CONF
'@
docker restart edtech-jitsi-jvb

Write-Host "[3/3] Waiting for JVB to restart..."
Start-Sleep 5

Write-Host "Done! Post-start configuration complete."
Write-Host "   API:   http://localhost:8000/health"
Write-Host "   Jitsi: https://localhost:8443"
Write-Host "   Docs:  http://localhost:8000/docs"
