#!/bin/bash
# Server Setup Script for OtterEVM Explorer Deployment
# Run this once on a new server to prepare for deployment

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Server Setup for OtterEVM Explorer                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Create directories
echo "[1/6] Creating directories..."
mkdir -p /data/nginx/conf.d
mkdir -p /data/nginx/ssl
mkdir -p /data/nginx/www
mkdir -p /data/otter-exp
mkdir -p /opt
echo "✓ Directories created"

# Check Docker
echo "[2/6] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed"
fi

# Check Docker Compose
echo "[3/6] Checking Docker Compose..."
if ! command -v docker compose &> /dev/null; then
    echo "Installing Docker Compose..."
    apt-get update
    apt-get install -y docker-compose-plugin
    echo "✓ Docker Compose installed"
else
    echo "✓ Docker Compose already installed"
fi

# Copy nginx configs
echo "[4/6] Copying nginx configuration..."
cp "${SCRIPT_DIR}/nginx/docker-compose.yml" /data/nginx/docker-compose.yml
cp "${SCRIPT_DIR}/nginx/nginx.conf" /data/nginx/nginx.conf
echo "✓ Nginx configs copied"

# Create nginx network
echo "[5/6] Creating nginx-network..."
if ! docker network ls | grep -q "nginx-network"; then
    docker network create nginx-network
    echo "✓ nginx-network created"
else
    echo "✓ nginx-network already exists"
fi

# Start nginx
echo "[6/6] Starting nginx proxy..."
cd /data/nginx
if docker ps | grep -q "nginx-proxy"; then
    echo "Reloading nginx..."
    docker compose exec nginx nginx -t
    docker compose exec nginx nginx -s reload
else
    echo "Starting nginx..."
    docker compose up -d
fi
echo "✓ Nginx proxy ready"

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Clone the repo: git clone https://github.com/otterevm/otter-apps.git /opt/otter-apps"
echo "2. Deploy chain explorer:"
echo "   cd /opt/otter-apps/deploy/pakxe && ./deploy.sh"
echo "   or"
echo "   cd /opt/otter-apps/deploy/aispoint && ./deploy.sh"
echo ""
