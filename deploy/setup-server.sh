#!/bin/bash
# Server Setup Script for OtterEVM Explorer Deployment
# Run this once on a new server to prepare for deployment

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Server Setup for OtterEVM Explorer                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Create directories
echo "[1/5] Creating directories..."
mkdir -p /data/nginx/conf.d
mkdir -p /data/otter-exp
mkdir -p /opt
echo "✓ Directories created"

# Check Docker
echo "[2/5] Checking Docker..."
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
echo "[3/5] Checking Docker Compose..."
if ! command -v docker compose &> /dev/null; then
    echo "Installing Docker Compose..."
    apt-get update
    apt-get install -y docker-compose-plugin
    echo "✓ Docker Compose installed"
else
    echo "✓ Docker Compose already installed"
fi

# Create nginx network
echo "[4/5] Creating nginx-network..."
if ! docker network ls | grep -q "nginx-network"; then
    docker network create nginx-network
    echo "✓ nginx-network created"
else
    echo "✓ nginx-network already exists"
fi

# Setup nginx proxy (optional)
echo "[5/5] Setting up nginx proxy..."
if ! docker ps | grep -q "nginx-proxy"; then
    echo "Starting nginx proxy..."
    docker run -d \
        --name nginx-proxy \
        --restart unless-stopped \
        --network nginx-network \
        -p 80:80 \
        -v /data/nginx/conf.d:/etc/nginx/conf.d:ro \
        -v /data/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
        nginx:alpine
    echo "✓ Nginx proxy started"
else
    echo "✓ Nginx proxy already running"
fi

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Clone the repo: git clone https://github.com/otterevm/otter-apps.git /opt/otter-apps"
echo "2. Deploy: cd /opt/otter-apps/deploy/pakxe && ./deploy.sh"
echo ""
