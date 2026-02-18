# Deployment Configurations

Complete deployment configurations for OtterEVM Explorer instances.

## Directory Structure

```
deploy/
├── README.md                    # This file
├── setup-server.sh              # One-time server setup
├── nginx/                       # Nginx base config (shared)
│   ├── docker-compose.yml
│   └── nginx.conf
├── aispoint/                    # AISPoint (Chain ID 7448)
│   ├── deploy.sh                # One-command deployment
│   ├── explorer/                # Docker Compose configuration
│   │   └── docker-compose.yml
│   └── nginx/                   # Nginx vhost config
│       └── aispoint.conf
└── pakxe/                       # Pakxe (Chain ID 7447)
    ├── deploy.sh                # One-command deployment
    ├── explorer/                # Docker Compose configuration
    │   └── docker-compose.yml
    └── nginx/                   # Nginx vhost config
        └── pakxe.conf
```

## Servers

| Chain | Server | Architecture | Domain |
|-------|--------|--------------|--------|
| AISPoint | 91.99.191.14 | ARM64 | aispoint.otterevm.com |
| Pakxe | 23.88.35.142 | AMD64 | pakxe.otterevm.com, rpc.pakxe.otterevm.com |

## Quick Start

### 1. New Server - Setup (Run Once)

```bash
ssh root@<server-ip>
git clone https://github.com/otterevm/otter-apps.git /opt/otter-apps
cd /opt/otter-apps/deploy
./setup-server.sh
```

This will:
- Install Docker & Docker Compose (if needed)
- Create `/data/nginx/` and `/data/otter-exp/` directories
- Copy nginx base config and docker-compose.yml
- Create `nginx-network`
- Start nginx proxy container

### 2. Deploy Chain Explorer

**Pakxe (23.88.35.142):**
```bash
ssh root@23.88.35.142
cd /opt/otter-apps/deploy/pakxe
./deploy.sh
```

**AISPoint (91.99.191.14):**
```bash
ssh root@91.99.191.14
cd /opt/otter-apps/deploy/aispoint
./deploy.sh
```

## What deploy.sh Does

1. Copy chain-specific nginx config to `/data/nginx/conf.d/`
2. Copy explorer docker-compose.yml to `/data/otter-exp/`
3. Ensure nginx is running (start or reload)
4. Pull and deploy explorer container

## Update from Repo

```bash
# On the server
cd /opt/otter-apps
git pull origin pakxe  # or aispoint-build

# Re-deploy
cd deploy/pakxe  # or deploy/aispoint
./deploy.sh
```

## Service URLs

### Pakxe
| Service | URL |
|---------|-----|
| Explorer | https://pakxe.otterevm.com |
| RPC | https://pakxe.otterevm.com/rpc |
| RPC Alias | https://rpc.pakxe.otterevm.com |
| WebSocket | wss://pakxe.otterevm.com/ws |
| WebSocket Alias | wss://rpc.pakxe.otterevm.com/ws |

### AISPoint
| Service | URL |
|---------|-----|
| Explorer | https://aispoint.otterevm.com |
| RPC | https://aispoint.otterevm.com/rpc |
| WebSocket | wss://aispoint.otterevm.com/ws |

## Troubleshooting

### Check all services
```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

### View logs
```bash
# Nginx
docker logs nginx-proxy

# Explorer
docker logs explorer-pakxe    # Pakxe
docker logs explorer-aispoint # AISPoint
```

### Restart services
```bash
# Restart nginx
cd /data/nginx
docker compose restart

# Restart explorer
cd /data/otter-exp
docker compose -f docker-compose-pakxe.yml restart  # Pakxe
docker compose restart                              # AISPoint
```

### Test RPC endpoint
```bash
curl -X POST https://pakxe.otterevm.com/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

## Configuration Details

### Nginx Docker Compose (Shared)
- Image: `nginx:alpine`
- Ports: `80:80`
- Volumes:
  - `./conf.d:/etc/nginx/conf.d:ro` (vhost configs from each chain)
  - `./nginx.conf:/etc/nginx/nginx.conf:ro` (base config)
- Network: `nginx-network`

### Explorer Docker Compose (Per Chain)
- Image: `ghcr.io/otterevm/explorer:<chain-tag>`
- Ports: internal only (3000)
- Network: `nginx-network`
- Environment: `NODE_ENV=production`

### Nginx Features
- Rate limiting: 20 requests burst
- CORS enabled (`*`)
- WebSocket upgrade support
- Proxy to explorer (3000) and RPC (8545/8546)

## Adding New Chain

1. Create directory structure:
   ```bash
   mkdir -p deploy/mynewchain/{nginx,explorer}
   ```

2. Add files:
   - `deploy/mynewchain/nginx/mynewchain.conf` - Nginx vhost config
   - `deploy/mynewchain/explorer/docker-compose.yml` - Explorer compose
   - `deploy/mynewchain/deploy.sh` - Deployment script (copy from pakxe)

3. Update `deploy.sh` paths for your chain

4. Commit and deploy:
   ```bash
   git add deploy/mynewchain/
   git commit -m "feat: add mynewchain deployment"
   git push origin pakxe
   ```

## File Locations on Server

| Component | Path |
|-----------|------|
| Nginx base | `/data/nginx/docker-compose.yml` |
| Nginx config | `/data/nginx/nginx.conf` |
| Vhost configs | `/data/nginx/conf.d/` |
| Explorer compose | `/data/otter-exp/docker-compose*.yml` |
