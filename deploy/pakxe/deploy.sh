#!/bin/bash
# Pakxe Explorer Deployment Script
# Usage: ./deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_DIR="/data/nginx/conf.d"
EXPLORER_DIR="/data/otter-exp"

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Pakxe Explorer Deployment                            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Copy nginx config
echo "[1/4] Copying nginx configuration..."
cp "${SCRIPT_DIR}/nginx/pakxe.conf" "${NGINX_DIR}/pakxe.conf"

# Copy docker-compose
echo "[2/4] Copying docker-compose configuration..."
cp "${SCRIPT_DIR}/explorer/docker-compose.yml" "${EXPLORER_DIR}/docker-compose-pakxe.yml"

# Reload nginx
echo "[3/4] Reloading nginx..."
if docker ps --format '{{.Names}}' | grep -q "^nginx-proxy$"; then
    docker exec nginx-proxy nginx -t
    docker exec nginx-proxy nginx -s reload
    echo "✓ Nginx reloaded"
else
    echo "⚠ Nginx container not running, skipping reload"
fi

# Deploy explorer
echo "[4/4] Deploying Pakxe Explorer..."
cd "${EXPLORER_DIR}"
docker compose -f docker-compose-pakxe.yml pull
docker compose -f docker-compose-pakxe.yml up -d --force-recreate

# Wait and check
sleep 3
if docker ps --filter name=explorer-pakxe --format '{{.Status}}' | grep -q "Up"; then
    echo ""
    echo "✅ Pakxe Explorer deployed successfully!"
    echo ""
    echo "URLs:"
    echo "  - Explorer: https://pakxe.otterevm.com"
    echo "  - RPC:      https://pakxe.otterevm.com/rpc"
    echo "  - RPC Alias: https://rpc.pakxe.otterevm.com"
    echo "  - WebSocket: wss://pakxe.otterevm.com/ws"
else
    echo ""
    echo "❌ Deployment failed! Check logs with:"
    echo "  docker logs explorer-pakxe"
    exit 1
fi
