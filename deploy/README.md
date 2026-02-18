# Deployment Configurations

Complete self-contained deployment configurations for OtterEVM Explorer instances.

## Directory Structure

Each chain has its own complete deployment directory:

```
deploy/
├── README.md                    # This file
├── aispoint/                    # AISPoint (Chain ID 7448)
│   ├── deploy.sh                # One-command deployment
│   ├── explorer/                # Explorer Docker Compose
│   │   └── docker-compose.yml
│   └── nginx/                   # Nginx with vhost config
│       ├── docker-compose.yml
│       ├── nginx.conf
│       └── conf.d/
│           └── aispoint.conf
└── pakxe/                       # Pakxe (Chain ID 7447)
    ├── deploy.sh                # One-command deployment
    ├── explorer/                # Explorer Docker Compose
    │   └── docker-compose.yml
    └── nginx/                   # Nginx with vhost config
        ├── docker-compose.yml
        ├── nginx.conf
        └── conf.d/
            └── pakxe.conf
```

## Servers

| Chain | Server | Architecture | Domain |
|-------|--------|--------------|--------|
| AISPoint | 91.99.191.14 | ARM64 | aispoint.otterevm.com |
| Pakxe | 23.88.35.142 | AMD64 | pakxe.otterevm.com, rpc.pakxe.otterevm.com |

## Quick Deploy

### 1. Copy to Server

**Pakxe (23.88.35.142):**
```bash
# From local machine
scp -r deploy/pakxe root@23.88.35.142:/opt/
ssh root@23.88.35.142
cd /opt/pakxe
./deploy.sh
```

**AISPoint (91.99.191.14):**
```bash
# From local machine
scp -r deploy/aispoint root@91.99.191.14:/opt/
ssh root@91.99.191.14
cd /opt/aispoint
./deploy.sh
```

### 2. Or Clone Repo on Server

```bash
ssh root@<server-ip>
git clone https://github.com/otterevm/otter-apps.git /opt/otter-apps
cd /opt/otter-apps/deploy/pakxe  # or aispoint
./deploy.sh
```

## What deploy.sh Does

1. Start nginx container with chain-specific config
2. Start explorer container
3. Both use the same Docker network (`<chain>-network`)

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

### Check services
```bash
cd /opt/pakxe  # or /opt/aispoint
docker compose -f nginx/docker-compose.yml ps
docker compose -f explorer/docker-compose.yml ps
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
cd /opt/pakxe  # or /opt/aispoint
docker compose -f nginx/docker-compose.yml restart
docker compose -f explorer/docker-compose.yml restart
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
  - `./conf.d:/etc/nginx/conf.d:ro` (vhost config)
  - `./nginx.conf:/etc/nginx/nginx.conf:ro` (base config)
- Network: `<chain>-network`

### Explorer Docker Compose
- Image: `ghcr.io/otterevm/explorer:<chain-tag>`
- Ports: internal only (3000)
- Network: `<chain>-network`
- Environment: `NODE_ENV=production`

### Nginx Features
- Rate limiting: 20 requests burst
- CORS enabled (`*`)
- WebSocket upgrade support
- Proxy to explorer (3000) and RPC (8545/8546)

## Adding New Chain

1. Copy `deploy/pakxe/` directory:
   ```bash
   cp -r deploy/pakxe deploy/mynewchain
   ```

2. Update files:
   - `nginx/conf.d/pakxe.conf` → `nginx/conf.d/mynewchain.conf` (update domains)
   - `nginx/docker-compose.yml` → change network name to `mynewchain-network`
   - `explorer/docker-compose.yml` → update image tag and network
   - `deploy.sh` → update container names

3. Commit and deploy:
   ```bash
   git add deploy/mynewchain/
   git commit -m "feat: add mynewchain deployment"
   git push origin pakxe
   ```
