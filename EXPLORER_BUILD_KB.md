# OtterEVM Explorer - Knowledge Base

> **Session Reference:** AISPoint Build & Deploy  
> **Created:** 2026-02-18  
> **Purpose:** Comprehensive guide for building and deploying chain-specific explorers

---

## 1. Project Overview

### 1.1 Repository Structure
```
otter-apps/                          # TypeScript monorepo
├── apps/explorer/                   # Main explorer application
│   ├── src/
│   │   ├── routes/                  # TanStack Start file-based routing
│   │   │   ├── __root.tsx          # Root layout (title/meta config here)
│   │   │   ├── _layout/index.tsx   # Homepage (add ChainInfo here)
│   │   │   └── _layout/*.tsx       # Other routes
│   │   ├── comps/                   # React components
│   │   │   └── ChainInfo.tsx       # Chain info + Add to Wallet button
│   │   ├── lib/
│   │   │   ├── chains.ts           # Chain configs & wallet config
│   │   │   └── server/*.ts         # Server functions (NO .server.ts extension!)
│   │   └── wagmi.config.ts         # Wagmi/RPC configuration
│   ├── Dockerfile                  # Multi-stage Docker build
│   ├── docker-compose.yml          # Local deployment
│   └── scripts/build-aispoint.sh   # Multi-arch build script
├── packages/rpc-utils/             # Shared RPC utilities
└── pnpm-workspace.yaml             # PNPM workspace config
```

### 1.2 Key Technologies
- **Framework:** TanStack Start (React + file-based routing)
- **Build Tool:** Vite (rolldown-vite)
- **State Management:** Wagmi + Viem (EVM interactions)
- **Styling:** Tailwind CSS v4
- **Container:** Docker + Wrangler (Cloudflare Workers runtime)
- **Package Manager:** PNPM

---

## 2. Chain Configuration System

### 2.1 Environment Variables
All chain-specific config is passed via build-args (Vite embeds at build time):

```bash
# Required build-args for Dockerfile
VITE_TEMPO_ENV=custom              # Must be 'custom' for chain-specific builds
VITE_CHAIN_NAME="AISPoint"         # Display name
VITE_CHAIN_ID="7448"               # Chain ID (numeric)
VITE_RPC_URL="https://aispoint.otterevm.com/rpc"
VITE_EXP_URL="https://aispoint.otterevm.com"
VITE_NATIVE="AIS"                  # Native currency symbol
VITE_LOGO_URL="/logo.svg"          # Optional: custom logo
```

### 2.2 Dockerfile Build-Args Setup
The Dockerfile MUST declare ARGs before build stage:

```dockerfile
# Stage 1: Build
FROM node:20-slim AS builder

# Build arguments for chain configuration
ARG VITE_TEMPO_ENV=custom
ARG VITE_CHAIN_NAME
ARG VITE_CHAIN_ID
ARG VITE_RPC_URL
ARG VITE_EXP_URL
ARG VITE_NATIVE
ARG VITE_LOGO_URL

# Set environment variables for build
ENV VITE_TEMPO_ENV=$VITE_TEMPO_ENV
ENV VITE_CHAIN_NAME=$VITE_CHAIN_NAME
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID
ENV VITE_RPC_URL=$VITE_RPC_URL
ENV VITE_EXP_URL=$VITE_EXP_URL
ENV VITE_NATIVE=$VITE_NATIVE
ENV VITE_LOGO_URL=$VITE_LOGO_URL
```

**CRITICAL:** Without these ENV declarations, Vite won't see the variables during build.

### 2.3 Code-Level Chain Config

#### lib/chains.ts
```typescript
// Get wallet chain config for MetaMask
export function getWalletChainConfig() {
    const chainId = Number(import.meta.env.VITE_CHAIN_ID || '7447')
    const chainName = import.meta.env.VITE_CHAIN_NAME || 'OtterEVM'
    const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://rpc.pakxe.otterevm.com/'
    const nativeCurrency = import.meta.env.VITE_NATIVE || 'OTTER'
    const explorerUrl = import.meta.env.VITE_EXP_URL || 'https://explorer.otterevm.com'

    return {
        chainId: `0x${chainId.toString(16)}`,  // Hex format required
        chainName,
        nativeCurrency: {
            name: nativeCurrency,
            symbol: nativeCurrency,
            decimals: 18,  // MUST be 18 for MetaMask compatibility
        },
        rpcUrls: [rpcUrl],
        blockExplorerUrls: explorerUrl ? [explorerUrl] : undefined,
    }
}
```

**IMPORTANT:** MetaMask requires `decimals: 18`. Even if the chain uses 6 decimals, use 18 here to avoid MetaMask errors.

---

## 3. Critical Build Issues & Solutions

### 3.1 TanStack Start Import Protection
**Problem:** Files with `.server.ts` extension cannot be imported from client code, even if they only export `createServerFn`.

**Error:**
```
[vite] [import-protection] Cannot import .server.ts file from client code
```

**Solution:** Rename files from `*.server.ts` to `*.ts`:
- `latest-block.server.ts` → `latest-block.ts`
- `token.server.ts` → `token-api.ts` (avoid conflicts)
- `tokens.server.ts` → `tokens.ts`

**Update all imports:**
```typescript
// Before
import { fetchLatestBlock } from '#lib/server/latest-block.server'

// After
import { fetchLatestBlock } from '#lib/server/latest-block'
```

### 3.2 Vite Build-Time Variables
**Problem:** `import.meta.env` variables are embedded at BUILD time, not runtime.

**Implication:** Cannot use runtime env vars in Docker. Must pass via build-args.

**Solution:** See section 2.1 and 2.2 for proper Dockerfile setup.

### 3.3 MetaMask Decimals Requirement
**Problem:** MetaMask throws error if `nativeCurrency.decimals !== 18`.

**Error:**
```
MetaMask - RPC Error: Expected the number 18 for 'nativeCurrency.decimals'
```

**Solution:** Always use `decimals: 18` in `getWalletChainConfig()`, even if chain uses different decimals.

---

## 4. Multi-Arch Docker Build Workflow

### 4.1 Build Script Structure
Script: `apps/explorer/scripts/build-aispoint.sh`

```bash
#!/bin/bash
set -e

# Server addresses (passed as args or env vars)
AMD64_SERVER="${1:-${AMD64_HOST:-}}"
ARM64_SERVER="${2:-${ARM64_HOST:-}}"

# Image configuration
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/otterevm/explorer}"
TAG="aispoint"                          # Chain-specific tag
BUILD_BRANCH="aispoint-build"           # Git branch to build

# Chain configuration
VITE_CHAIN_NAME="AISPoint"
VITE_CHAIN_ID="7448"
VITE_RPC_URL="https://aispoint.otterevm.com/rpc"
VITE_EXP_URL="https://aispoint.otterevm.com"
VITE_NATIVE="AIS"
```

### 4.2 Remote Build Function
Builds execute natively on each architecture server via SSH:

```bash
remote_build() {
    local server=$1
    local arch=$2
    local arch_tag="${TAG}-${arch}"
    
    ssh -i "$SSH_KEY" "$SSH_USER@$server" "cat > $remote_script" << BUILD_SCRIPT
#!/bin/bash
set -e

# Clone and build
BUILD_DIR="/tmp/explorer-build-\$(date +%s)"
git clone --depth 1 --branch "$BUILD_BRANCH" "$REPO_URL" otter-apps
cd otter-apps

# Docker build with chain config
docker buildx build --provenance=false \\
    --build-arg VITE_CHAIN_NAME="$VITE_CHAIN_NAME" \\
    --build-arg VITE_CHAIN_ID="$VITE_CHAIN_ID" \\
    --build-arg VITE_RPC_URL="$VITE_RPC_URL" \\
    --build-arg VITE_EXP_URL="$VITE_EXP_URL" \\
    --build-arg VITE_NATIVE="$VITE_NATIVE" \\
    --build-arg VITE_TEMPO_ENV=custom \\
    -f apps/explorer/Dockerfile \\
    -t "\$IMAGE_NAME:\$ARCH_TAG" \\
    .

# Push architecture-specific tag
docker push "\$IMAGE_NAME:\$ARCH_TAG"
BUILD_SCRIPT

    ssh -i "$SSH_KEY" "$SSH_USER@$server" "bash $remote_script"
}
```

### 4.3 Multi-Arch Manifest Creation
After both builds complete:

```bash
# Create multi-arch manifest
docker manifest rm "$IMAGE_NAME:$TAG" 2>/dev/null || true
docker manifest create "$IMAGE_NAME:$TAG" \\
    --amend "$IMAGE_NAME:${TAG}-amd64" \\
    --amend "$IMAGE_NAME:${TAG}-arm64"

# Annotate architectures
docker manifest annotate "$IMAGE_NAME:$TAG" "$IMAGE_NAME:${TAG}-amd64" --arch amd64
docker manifest annotate "$IMAGE_NAME:$TAG" "$IMAGE_NAME:${TAG}-arm64" --arch arm64

# Push manifest
docker manifest push "$IMAGE_NAME:$TAG"
```

### 4.4 Running the Build
```bash
# From repo root
cd /Users/dome/project/otterevm/otter-apps
bash apps/explorer/scripts/build-aispoint.sh 23.88.35.142 91.99.191.14
```

**Servers:**
- `23.88.35.142` - AMD64 build server
- `91.99.191.14` - ARM64 build server + production

---

## 5. Deployment Configuration

### 5.1 Production Server Setup (91.99.191.14)

**Directory:** `/data/otter-exp/`

**docker-compose.yml:**
```yaml
services:
  explorer-aispoint:
    image: ghcr.io/otterevm/explorer:aispoint
    container_name: explorer-aispoint
    networks:
      - nginx-network
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=1024
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

networks:
  nginx-network:
    external: true
```

**Nginx Reverse Proxy:**
- Config location: `/data/nginx/conf.d/aispoint.conf`
- Container: `nginx-proxy` (connected to `nginx-network`)
- Proxy passes to container name: `explorer-aispoint:3000`

### 5.2 Deployment Commands
```bash
ssh root@91.99.191.14
cd /data/otter-exp

# Pull and deploy
docker compose pull
docker compose up -d --force-recreate

# Verify
docker compose ps
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

---

## 6. Component Development

### 6.1 ChainInfo Component
**Location:** `apps/explorer/src/comps/ChainInfo.tsx`

**Purpose:** Display chain info + "Add to Wallet" button

**Features:**
- Shows chain name, chain ID, native currency
- Calls `wallet_addEthereumChain` via MetaMask
- Falls back to MetaMask download if no wallet detected
- Shows success state after adding

**Usage:**
```tsx
import { ChainInfo } from '#comps/ChainInfo'

// In homepage (_layout/index.tsx)
<div className="w-full flex justify-center px-4">
    <ChainInfo />
</div>
```

### 6.2 Dynamic Title
**Location:** `apps/explorer/src/routes/__root.tsx`

**Implementation:**
```tsx
head: () => {
    const chainName = import.meta.env.VITE_CHAIN_NAME || 'OtterEVM'
    const title = `Explorer ⋅ ${chainName}`
    const description = `Explore and analyze blocks, transactions, contracts and more on ${chainName}.`
    return {
        meta: [
            { title: title },
            { name: 'og:title', content: title },
            { name: 'description', content: description },
            { name: 'og:description', content: description },
        ],
        // ... links
    }
}
```

**Note:** Must return object with `meta` and `links` properties, not just meta array.

---

## 7. Branch Strategy

### 7.1 Existing Branches
| Branch | Purpose | Chain ID |
|--------|---------|----------|
| `aispoint-build` | AISPoint development | 7448 |
| `pakxe` | Pakxe chain (new) | 7447 |

### 7.2 Creating New Chain Branch
```bash
# From aispoint-build (working base)
git checkout aispoint-build
git pull origin aispoint-build

# Create new branch
git checkout -b pakxe
git push origin pakxe
```

### 7.3 Tags for Releases
```bash
# Create tag
git tag -a "aispoint-v1.1.0" -m "AISPoint Explorer v1.1.0 - MetaMask support"
git push origin aispoint-v1.1.0
```

---

## 8. Adding New Chain (Pakxe Example)

### 8.1 Create Build Script
Copy `build-aispoint.sh` → `build-pakxe.sh`

**Changes:**
```bash
TAG="pakxe"
BUILD_BRANCH="pakxe"

# Pakxe Configuration
VITE_CHAIN_NAME="Pakxe"
VITE_CHAIN_ID="7447"
VITE_RPC_URL="https://rpc.pakxe.otterevm.com/"
VITE_EXP_URL="https://pakxe.otterevm.com"
VITE_NATIVE="OTTER"
```

### 8.2 Production Deployment
**Server:** Same ARM64 server (91.99.191.14)

**New docker-compose.yml:**
```yaml
services:
  explorer-pakxe:
    image: ghcr.io/otterevm/explore:pakxe
    container_name: explorer-pakxe
    networks:
      - nginx-network
    # ... same config
```

**Nginx Config:** Add server block for `pakxe.otterevm.com`

---

## 9. Common Commands

### 9.1 Local Development
```bash
cd apps/explorer

# Install dependencies
pnpm install

# Type check
pnpm check:types

# Lint/format
pnpm check

# Dev server (needs env vars)
VITE_CHAIN_NAME="AISPoint" VITE_CHAIN_ID="7448" ... pnpm dev
```

### 9.2 Local Docker Build
```bash
cd /Users/dome/project/otterevm/otter-apps

docker build \
  --build-arg VITE_TEMPO_ENV=custom \
  --build-arg VITE_CHAIN_NAME="AISPoint" \
  --build-arg VITE_CHAIN_ID="7448" \
  --build-arg VITE_RPC_URL="https://aispoint.otterevm.com/rpc" \
  --build-arg VITE_EXP_URL="https://aispoint.otterevm.com" \
  --build-arg VITE_NATIVE="AIS" \
  -f apps/explorer/Dockerfile \
  -t explorer-aispoint:test \
  .
```

### 9.3 Container Management
```bash
# Stop all local containers
docker stop $(docker ps -q --filter name=explorer)
docker rm $(docker ps -aq --filter name=explorer)

# List images
docker images | grep explorer

# Clean up
docker system prune -f
```

---

## 10. Troubleshooting

### 10.1 Build Failures
| Issue | Solution |
|-------|----------|
| Import protection error | Rename `.server.ts` → `.ts` |
| Vite env undefined | Add ARG/ENV in Dockerfile |
| Type errors | Run `pnpm check:types` locally first |
| Docker cache issues | Add `--no-cache` to build |

### 10.2 Runtime Issues
| Issue | Solution |
|-------|----------|
| Wrong block number | Verify VITE_RPC_URL in build args |
| Title shows OtterEVM | Check VITE_CHAIN_NAME is set |
| MetaMask decimals error | Use `decimals: 18` in config |
| 404 on homepage | Wait for wrangler to fully start |

### 10.3 SSH/Remote Issues
```bash
# Test SSH connectivity
ssh -i ~/.ssh/id_ed25519-dokcer root@91.99.191.14 "echo 'OK'"

# Check remote Docker
docker -H ssh://root@91.99.191.14 ps
```

---

## 11. Key Files Reference

### 11.1 Must-Edit for New Chain
1. `apps/explorer/scripts/build-CHAIN.sh` - Build configuration
2. `apps/explorer/src/lib/chains.ts` - Chain config (if needed)
3. `apps/explorer/Dockerfile` - Already has ARGs setup

### 11.2 Read-Only Reference
- `apps/explorer/src/comps/ChainInfo.tsx` - Reusable component
- `apps/explorer/src/routes/__root.tsx` - Title configuration
- `apps/explorer/src/wagmi.config.ts` - RPC configuration

---

## 12. Environment Checklist

Before building, verify:
- [ ] Git branch pushed to origin
- [ ] Dockerfile has ARG/ENV declarations
- [ ] All imports use correct paths (no `.server.ts`)
- [ ] `pnpm check:types` passes locally
- [ ] Build script has correct chain config
- [ ] Remote servers accessible via SSH
- [ ] Docker Hub/Registry credentials available

---

**End of Knowledge Base**
