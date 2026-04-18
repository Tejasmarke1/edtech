# Post-start configuration for Jitsi containers.
# Run this ONCE after "docker compose up -d" completes.

Write-Host "[1/3] Injecting nginx websocket config..."
docker cp "$PSScriptRoot\..\websocket.conf" edtech-jitsi-web:/etc/nginx/conf.d/websocket.conf
docker exec edtech-jitsi-web nginx -s reload

Write-Host "[2/3] Disabling AWS harvester in JVB..."
docker exec edtech-jitsi-jvb sh -c @'
printf 'ice4j {\n    harvest {\n        mapping {\n            aws {\n                enabled = false\n            }\n        }\n    }\n}\n' > /config/custom-jvb.conf
'@
docker restart edtech-jitsi-jvb

Write-Host "[3/3] Waiting for JVB to restart..."
Start-Sleep 5

Write-Host "Done! Post-start configuration complete."
Write-Host "   API:   http://localhost:8000/health"
Write-Host "   Jitsi: https://localhost:8443"
Write-Host "   Docs:  http://localhost:8000/docs"
Write-Host "   Note:  For other devices on LAN, set JVB_ADVERTISE_IPS in .env to your PC IPv4 (not 127.0.0.1)."
