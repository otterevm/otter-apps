#!/bin/bash
# Pakxe Explorer Deployment Script
# Usage: ./deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
NGINX_DIR="/data/nginx"
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

# Copy nginx configs (all from conf.d)
echo "[1/5] Copying nginx configurations..."
cp "${DEPLOY_DIR}/nginx/conf.d/"*.conf "${NGINX_DIR}/conf.d/"

# Copy docker-compose
echo "[2/5] Copying docker-compose configuration..."
cp "${SCRIPT_DIR}/explorer/docker-compose.yml" "${EXPLORER_DIR}/docker-compose-pakxe.yml"

# Start nginx if not running
echo "[3/5] Ensuring nginx is running..."
cd "${NGINX_DIR}"
if ! docker ps | grep -q "nginx-proxy"; then
    echo "Starting nginx..."
    docker compose up -d
else
    echo "Reloading nginx..."
    docker compose exec nginx nginx -t
    docker compose exec nginx nginx -s reload
fi
echo "✓ Nginx ready"

# Deploy explorer
echo "[4/5] Deploying Pakxe Explorer..."
cd "${EXPLORER_DIR}"
docker compose -f docker-compose-pakxe.yml pull
docker compose -f docker-compose-pakxe.yml up -d --force-recreate

# Wait and check
echo "[5/5] Waiting for container to start..."
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
