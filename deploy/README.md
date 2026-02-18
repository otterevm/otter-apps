# Deployment Configurations

This directory contains deployment configurations for OtterEVM Explorer instances.

## Structure

```
deploy/
├── aispoint/          # AISPoint (Chain ID 7448) - ARM64
│   ├── docker-compose.yml
│   └── nginx.conf
├── pakxe/             # Pakxe (Chain ID 7447) - AMD64
│   ├── docker-compose.yml
│   └── nginx.conf
└── README.md
```

## Servers

| Chain | Server | Architecture | Domain |
|-------|--------|--------------|--------|
| AISPoint | 91.99.191.14 | ARM64 | aispoint.otterevm.com |
| Pakxe | 23.88.35.142 | AMD64 | pakxe.otterevm.com, rpc.pakxe.otterevm.com |

## Quick Deploy

### AISPoint

```bash
ssh root@91.99.191.14
cd /data/otter-exp
docker compose pull
docker compose up -d
```

### Pakxe

```bash
ssh root@23.88.35.142
cd /data/otter-exp
docker compose -f docker-compose-pakxe.yml pull
docker compose -f docker-compose-pakxe.yml up -d
```

## Nginx Reload

After updating nginx configs:

```bash
docker exec nginx-proxy nginx -t
docker exec nginx-proxy nginx -s reload
```

## Update Configs from Repo

```bash
# On local machine
cd /path/to/otter-apps

# Copy to AISPoint
scp deploy/aispoint/* root@91.99.191.14:/data/otter-exp/
scp deploy/aispoint/nginx.conf root@91.99.191.14:/data/nginx/conf.d/

# Copy to Pakxe
scp deploy/pakxe/docker-compose.yml root@23.88.35.142:/data/otter-exp/docker-compose-pakxe.yml
scp deploy/pakxe/nginx.conf root@23.88.35.142:/data/nginx/conf.d/
```

## Docker Networks

Both deployments use the `nginx-network` (external):

```bash
docker network create nginx-network
```

## Environment Variables

See individual docker-compose.yml files for environment configuration.
