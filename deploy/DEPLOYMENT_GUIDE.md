# Explorer Deployment Guide

> Deploy Explorer + Nginx using pre-built images (no build required)

## Prerequisites

- Server with Docker & Docker Compose installed
- Pre-built Docker image: `ghcr.io/otterevm/explorer:<tag>`
- Domain name configured (DNS A record pointing to server)
- RPC endpoint running (node/chain) at port 8545 (HTTP) and 8546 (WebSocket)

## Quick Start (2 Steps)

### Step 1: Copy Deployment Files

```bash
# From your local machine, copy deployment to server
scp -r deploy/pakxe root@<server-ip>:/opt/

# Or clone repo on server
git clone https://github.com/otterevm/otter-apps.git /opt/otter-apps
```

### Step 2: Run Deploy Script

```bash
ssh root@<server-ip>
cd /opt/pakxe  # or /opt/aispoint
./deploy.sh
```

That's it! Explorer will be running at `https://<your-domain>`

---

## Directory Structure

```
deploy/pakxe/                    # Each chain has its own directory
├── deploy.sh                    # One-command deployment
├── explorer/
│   └── docker-compose.yml       # Explorer container config
└── nginx/
    ├── docker-compose.yml       # Nginx container config
    ├── nginx.conf               # Base nginx settings
    └── conf.d/
        └── pakxe.conf           # Domain/routing config
```

---

## For New Chain

### 1. Copy Template

```bash
cd deploy
cp -r pakxe mynewchain
```

### 2. Edit nginx/conf.d/mynewchain.conf

```nginx
# Change these:
server_name mynewchain.otterevm.com;

# RPC backend (your node)
location /rpc {
    proxy_pass http://<node-ip>:8545/;
}

# WebSocket backend
location /ws {
    proxy_pass http://<node-ip>:8546;
}
```

### 3. Edit explorer/docker-compose.yml

```yaml
services:
  explorer-mynewchain:
    image: ghcr.io/otterevm/explorer:mynewchain  # or use pakxe tag
    container_name: explorer-mynewchain
    networks:
      - mynewchain-network
    # ... rest same

networks:
  mynewchain-network:
    name: mynewchain-network
```

### 4. Edit nginx/docker-compose.yml

```yaml
networks:
  mynewchain-network:
    name: mynewchain-network
```

### 5. Deploy

```bash
cd mynewchain
./deploy.sh
```

---

## Manual Deploy (Without Script)

If you prefer not using `deploy.sh`:

```bash
# 1. Start nginx
cd nginx
docker compose up -d

# 2. Start explorer
cd ../explorer
docker compose up -d

# 3. Check status
docker ps
```

---

## Troubleshooting

### Container not starting
```bash
docker logs explorer-<chainname>
```

### Nginx errors
```bash
docker logs nginx-proxy
docker exec nginx-proxy nginx -t  # Test config
```

### Restart services
```bash
# Restart nginx
cd nginx && docker compose restart

# Restart explorer
cd explorer && docker compose restart
```

### Check network
```bash
docker network ls
docker network inspect <chain>-network
```

---

## Using Existing Image (No Build)

To use an existing image without building:

1. **In `explorer/docker-compose.yml`**:
```yaml
image: ghcr.io/otterevm/explorer:pakxe  # or aispoint, or any tag
```

2. **Make sure the image exists**:
```bash
docker pull ghcr.io/otterevm/explorer:pakxe
```

3. **Deploy**:
```bash
./deploy.sh
```

No build process, no source code needed. Just Docker and the image!

---

## Cloudflare / SSL

This deployment uses port 80 (HTTP). For HTTPS:

1. **Option A**: Use Cloudflare Proxy (Flexible SSL)
   - Set DNS proxy to "Orange Cloud" in Cloudflare
   - Done! Cloudflare provides SSL

2. **Option B**: Add certbot to nginx
   - Modify nginx/docker-compose.yml to include certbot
   - Or use nginx-proxy-manager

---

## Common Issues

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Check node RPC is running and accessible |
| CORS errors | Nginx config already handles CORS, check headers |
| Wrong block number | Image has wrong RPC URL, need image with correct config |
| Domain not resolving | Check DNS A record points to server IP |

---

## Summary

**To deploy a new chain:**
1. Copy `deploy/pakxe/` folder
2. Edit 3 files: nginx conf, 2x docker-compose.yml (network name)
3. Run `./deploy.sh`

**Time required**: 5-10 minutes  
**Build required**: None (use existing image)  
**Docker required**: Yes
