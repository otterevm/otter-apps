# Deployment Configurations

Complete deployment configurations for OtterEVM Explorer instances.

## Directory Structure

```
deploy/
├── README.md                    # This file
├── setup-server.sh              # One-time server setup
├── nginx/                       # Nginx reverse proxy (shared)
│   ├── docker-compose.yml       # Nginx container
│   ├── nginx.conf               # Base nginx config
│   └── conf.d/                  # Virtual host configs (IMPORTANT!)
│       ├── aispoint.conf
│       ├── exp.conf
│       ├── pakxe.conf
│       └── rpc.conf
├── aispoint/                    # AISPoint (Chain ID 7448)
│   ├── deploy.sh                # One-command deployment
│   └── explorer/                # Docker Compose configuration
│       └── docker-compose.yml
└── pakxe/                       # Pakxe (Chain ID 7447)
    ├── deploy.sh                # One-command deployment
    └── explorer/                # Docker Compose configuration
        └── docker-compose.yml
```

## ⚠️ Important: conf.d is Shared!

All nginx virtual host configs are in `deploy/nginx/conf.d/` and are **shared across all chains**. 

When you deploy any chain, it copies ALL configs from `conf.d/` to the server.

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
- Copy nginx base config, docker-compose.yml, and all conf.d configs
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

1. Copy **ALL** nginx configs from `deploy/nginx/conf.d/` to `/data/nginx/conf.d/`
2. Copy explorer docker-compose.yml to `/data/otter-exp/`
3. Ensure nginx is running (start or reload)
4. Pull and deploy explorer container

## Update from Repo

```bash
# On the server
cd /opt/otter-apps
git pull origin pakxe  # or aispoint-build for AISPoint specific

# Re-deploy (this will update ALL nginx configs)
cd deploy/pakxe  # or deploy/aispoint
./deploy.sh
```

## Adding New Nginx Config

If you need to add a new nginx config:

1. Add config file to `deploy/nginx/conf.d/`
2. Commit and push
3. Deploy any chain (configs are shared)

Example:
```bash
cp mynewchain.conf deploy/nginx/conf.d/
git add deploy/nginx/conf.d/mynewchain.conf
git commit -m "feat: add nginx config for mynewchain"
git push origin pakxe
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

### Nginx Docker Compose
- Image: `nginx:alpine`
- Ports: `80:80`
- Volumes:
  - `./conf.d:/etc/nginx/conf.d:ro` (all vhost configs)
  - `./nginx.conf:/etc/nginx/nginx.conf:ro` (base config)
- Network: `nginx-network`

### Explorer Docker Compose
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

1. Create `deploy/<chain>/` directory:
   ```bash
   mkdir -p deploy/mynewchain/explorer
   ```

2. Add nginx config to `deploy/nginx/conf.d/mynewchain.conf`

3. Create `deploy/mynewchain/explorer/docker-compose.yml`

4. Create `deploy/mynewchain/deploy.sh` (copy from pakxe/deploy.sh and modify)

5. Update this README

6. Commit and deploy:
   ```bash
   git add deploy/
   git commit -m "feat: add mynewchain deployment"
   git push origin pakxe
   ```
