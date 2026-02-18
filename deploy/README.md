# Deployment Configurations

Complete deployment configurations for OtterEVM Explorer instances.

## Directory Structure

```
deploy/
├── aispoint/              # AISPoint (Chain ID 7448)
│   ├── deploy.sh          # One-command deployment script
│   ├── explorer/          # Docker Compose configuration
│   │   └── docker-compose.yml
│   └── nginx/             # Nginx reverse proxy config
│       └── aispoint.conf
├── pakxe/                 # Pakxe (Chain ID 7447)
│   ├── deploy.sh          # One-command deployment script
│   ├── explorer/          # Docker Compose configuration
│   │   └── docker-compose.yml
│   └── nginx/             # Nginx reverse proxy config
│       └── pakxe.conf
└── README.md
```

## Servers

| Chain | Server | Architecture | Domain |
|-------|--------|--------------|--------|
| AISPoint | 91.99.191.14 | ARM64 | aispoint.otterevm.com |
| Pakxe | 23.88.35.142 | AMD64 | pakxe.otterevm.com, rpc.pakxe.otterevm.com |

## Quick Deploy

### Prerequisites

1. Server setup with:
   - Docker & Docker Compose installed
   - `nginx-network` created: `docker network create nginx-network`
   - Nginx proxy container running (for reverse proxy)
   - `/data/nginx/conf.d/` directory exists
   - `/data/otter-exp/` directory exists

2. Clone this repo on the server:
```bash
git clone https://github.com/otterevm/otter-apps.git /opt/otter-apps
cd /opt/otter-apps
```

### Deploy Pakxe (23.88.35.142)

```bash
ssh root@23.88.35.142
cd /opt/otter-apps/deploy/pakxe
./deploy.sh
```

### Deploy AISPoint (91.99.191.14)

```bash
ssh root@91.99.191.14
cd /opt/otter-apps/deploy/aispoint
./deploy.sh
```

## Manual Deploy (Alternative)

### Pakxe

```bash
# 1. Copy configs
cp deploy/pakxe/nginx/pakxe.conf /data/nginx/conf.d/
cp deploy/pakxe/explorer/docker-compose.yml /data/otter-exp/docker-compose-pakxe.yml

# 2. Reload nginx
docker exec nginx-proxy nginx -t
docker exec nginx-proxy nginx -s reload

# 3. Deploy explorer
cd /data/otter-exp
docker compose -f docker-compose-pakxe.yml pull
docker compose -f docker-compose-pakxe.yml up -d
```

### AISPoint

```bash
# 1. Copy configs
cp deploy/aispoint/nginx/aispoint.conf /data/nginx/conf.d/
cp deploy/aispoint/explorer/docker-compose.yml /data/otter-exp/docker-compose.yml

# 2. Reload nginx
docker exec nginx-proxy nginx -t
docker exec nginx-proxy nginx -s reload

# 3. Deploy explorer
cd /data/otter-exp
docker compose pull
docker compose up -d
```

## Update from Repo

To update deployment configs from this repo:

```bash
# On the server
cd /opt/otter-apps
git pull origin pakxe  # or aispoint-build for AISPoint

# Re-run deploy script
cd deploy/pakxe  # or deploy/aispoint
./deploy.sh
```

## Service URLs

### Pakxe
- **Explorer:** https://pakxe.otterevm.com
- **RPC:** https://pakxe.otterevm.com/rpc
- **RPC Alias:** https://rpc.pakxe.otterevm.com
- **WebSocket:** wss://pakxe.otterevm.com/ws
- **WebSocket Alias:** wss://rpc.pakxe.otterevm.com/ws

### AISPoint
- **Explorer:** https://aispoint.otterevm.com
- **RPC:** https://aispoint.otterevm.com/rpc
- **WebSocket:** wss://aispoint.otterevm.com/ws

## Troubleshooting

### Check container status
```bash
docker ps --filter name=explorer
```

### View logs
```bash
docker logs explorer-pakxe    # Pakxe
docker logs explorer-aispoint # AISPoint
```

### Restart explorer only
```bash
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

### Environment Variables (Docker Compose)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | Node environment |
| `NODE_OPTIONS` | --max-old-space-size=1024 | Node memory limit |

### Nginx Configuration

- Rate limiting: 20 requests burst
- CORS enabled for all origins (`*`)
- WebSocket upgrade support
- Proxy to port 3000 (explorer) and 8545/8546 (RPC)

## Adding New Chain

1. Copy `deploy/pakxe/` or `deploy/aispoint/` as template
2. Update domain names in nginx config
3. Update docker-compose with correct image tag
4. Create deploy.sh with appropriate paths
5. Update this README
