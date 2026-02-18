#!/bin/bash
# Pakxe Explorer Deployment Script
# Usage: ./deploy.sh
# This script deploys both nginx and explorer for Pakxe chain

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Pakxe Explorer Deployment                            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Deploy Nginx
echo "[1/2] Deploying Nginx..."
cd "${SCRIPT_DIR}/nginx"
docker compose up -d
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload 2>/dev/null || true
echo "✓ Nginx ready"

# Deploy Explorer
echo "[2/2] Deploying Pakxe Explorer..."
cd "${SCRIPT_DIR}/explorer"
docker compose pull
docker compose up -d --force-recreate

# Wait and check
sleep 3
if docker ps --filter name=explorer-pakxe --format '{{.Status}}' | grep -q "Up"; then
    echo ""
    echo "✅ Pakxe Explorer deployed successfully!"
    echo ""
    echo "URLs:"
    echo "  - Explorer:  https://pakxe.otterevm.com"
    echo "  - RPC:       https://pakxe.otterevm.com/rpc"
    echo "  - RPC Alias: https://rpc.pakxe.otterevm.com"
    echo "  - WebSocket: wss://pakxe.otterevm.com/ws"
    echo "  - WS Alias:  wss://rpc.pakxe.otterevm.com/ws"
else
    echo ""
    echo "❌ Deployment failed! Check logs with:"
    echo "  docker logs explorer-pakxe"
    exit 1
fi
