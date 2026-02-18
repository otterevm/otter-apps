#!/bin/bash
# AISPoint Explorer Deployment Script
# Usage: ./deploy.sh
# This script deploys both nginx and explorer for AISPoint chain

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔════════════════════════════════════════════════════════╗"
echo "║   AISPoint Explorer Deployment                         ║"
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
echo "[2/2] Deploying AISPoint Explorer..."
cd "${SCRIPT_DIR}/explorer"
docker compose pull
docker compose up -d --force-recreate

# Wait and check
sleep 3
if docker ps --filter name=explorer-aispoint --format '{{.Status}}' | grep -q "Up"; then
    echo ""
    echo "✅ AISPoint Explorer deployed successfully!"
    echo ""
    echo "URLs:"
    echo "  - Explorer:  https://aispoint.otterevm.com"
    echo "  - RPC:       https://aispoint.otterevm.com/rpc"
    echo "  - WebSocket: wss://aispoint.otterevm.com/ws"
else
    echo ""
    echo "❌ Deployment failed! Check logs with:"
    echo "  docker logs explorer-aispoint"
    exit 1
fi
