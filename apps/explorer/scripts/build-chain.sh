#!/bin/bash

# Multi-arch Docker build for specific chain
# Builds separate images for each chain with embedded config
#
# Usage: ./build-chain.sh <chain-name> [amd64-server] [arm64-server]
# Example: ./build-chain.sh aispoint 23.88.35.142 91.99.191.14

set -e

# Chain configuration
CHAIN_NAME="${1:-}"
AMD64_SERVER="${2:-${AMD64_HOST:-}}"
ARM64_SERVER="${3:-${ARM64_HOST:-}}"

if [ -z "$CHAIN_NAME" ]; then
    echo "Error: Chain name required"
    echo "Usage: $0 <chain-name> [amd64-server] [arm64-server]"
    echo ""
    echo "Examples:"
    echo "  $0 aispoint 23.88.35.142 91.99.191.14"
    echo "  $0 pakxe 23.88.35.142 91.99.191.14"
    exit 1
fi

# Image naming
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/otterevm/explorer}"
TAG="$CHAIN_NAME"
AMD64_TAG="${TAG}-amd64"
ARM64_TAG="${TAG}-arm64"

# Chain configs (add more chains as needed)
case "$CHAIN_NAME" in
    aispoint)
        VITE_CHAIN_NAME="AISPoint"
        VITE_CHAIN_ID="7448"
        VITE_RPC_URL="https://aispoint.otterevm.com/rpc"
        VITE_EXP_URL="https://aispoint.otterevm.com"
        VITE_NATIVE="AIS"
        ;;
    pakxe)
        VITE_CHAIN_NAME="Pakxe"
        VITE_CHAIN_ID="7447"
        VITE_RPC_URL="https://rpc.pakxe.otterevm.com/"
        VITE_EXP_URL=""
        VITE_NATIVE="OTTER"
        ;;
    *)
        echo "Error: Unknown chain '$CHAIN_NAME'"
        echo "Supported chains: aispoint, pakxe"
        echo ""
        echo "To add a new chain, edit the case statement in this script"
        exit 1
        ;;
esac

# SSH Configuration
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519-dokcer}"
SSH_USER="${SSH_USER:-root}"
REPO_URL="${REPO_URL:-https://github.com/otterevm/otter-apps.git}"
BUILD_BRANCH="${BUILD_BRANCH:-otterevm}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate
if [ -z "$AMD64_SERVER" ] || [ -z "$ARM64_SERVER" ]; then
    log_error "Server addresses required"
    echo "Usage: $0 <chain-name> [amd64-server] [arm64-server]"
    exit 1
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Chain-Specific Docker Build - OtterEVM Explorer      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Chain Configuration:"
echo "  Chain Name: $VITE_CHAIN_NAME"
echo "  Chain ID:   $VITE_CHAIN_ID"
echo "  RPC URL:    $VITE_RPC_URL"
echo "  Explorer:   $VITE_EXP_URL"
echo "  Native:     $VITE_NATIVE"
echo ""
log_info "Build Configuration:"
echo "  Image:      $IMAGE_NAME"
echo "  Tags:       $TAG, $AMD64_TAG, $ARM64_TAG"
echo "  AMD64:      $SSH_USER@$AMD64_SERVER"
echo "  ARM64:      $SSH_USER@$ARM64_SERVER"
echo ""

# Remote build function
remote_build() {
    local server=$1
    local arch=$2
    local arch_tag="${TAG}-${arch}"
    
    log_info "[$arch] Starting build on $server..."
    
    local remote_script="/tmp/build-explorer-${arch}-$(date +%s).sh"
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$server" "cat > $remote_script" << BUILD_SCRIPT
#!/bin/bash
set -e

ARCH="\$1"
TAG="\$2"
IMAGE_NAME="\$3"
ARCH_TAG="\${TAG}-\${ARCH}"
REPO_URL="$REPO_URL"
BUILD_BRANCH="$BUILD_BRANCH"

# Build args
VITE_CHAIN_NAME="$VITE_CHAIN_NAME"
VITE_CHAIN_ID="$VITE_CHAIN_ID"
VITE_RPC_URL="$VITE_RPC_URL"
VITE_EXP_URL="$VITE_EXP_URL"
VITE_NATIVE="$VITE_NATIVE"

BUILD_DIR="/tmp/explorer-build-$(date +%s)"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

echo "[$ARCH] Building in $BUILD_DIR..."

echo "[$ARCH] Cloning $REPO_URL ($BUILD_BRANCH)..."
git clone --depth 1 --branch "$BUILD_BRANCH" "$REPO_URL" otter-apps
cd otter-apps

echo "[$ARCH] Building Docker image with chain config..."
docker buildx build --provenance=false \
    --build-arg VITE_CHAIN_NAME="$VITE_CHAIN_NAME" \
    --build-arg VITE_CHAIN_ID="$VITE_CHAIN_ID" \
    --build-arg VITE_RPC_URL="$VITE_RPC_URL" \
    --build-arg VITE_EXP_URL="$VITE_EXP_URL" \
    --build-arg VITE_NATIVE="$VITE_NATIVE" \
    --build-arg VITE_TEMPO_ENV=custom \
    -f apps/explorer/Dockerfile \
    -t "$IMAGE_NAME:$ARCH_TAG" \
    .

echo "[$ARCH] Pushing $IMAGE_NAME:$ARCH_TAG..."
docker push "$IMAGE_NAME:$ARCH_TAG"

cd /
rm -rf "$BUILD_DIR"

echo "[$ARCH] Build complete!"
BUILD_SCRIPT

    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$server" \
        "chmod +x $remote_script && bash $remote_script $arch $TAG $IMAGE_NAME; rm -f $remote_script"
}

# Start parallel builds
log_info "Starting parallel builds..."
echo ""

remote_build "$AMD64_SERVER" "amd64" &
AMD64_PID=$!
remote_build "$ARM64_SERVER" "arm64" &
ARM64_PID=$!

# Wait
AMD64_OK=true
ARM64_OK=true

if ! wait $AMD64_PID; then
    AMD64_OK=false
fi

if ! wait $ARM64_PID; then
    ARM64_OK=false
fi

echo ""

if [ "$AMD64_OK" = false ] || [ "$ARM64_OK" = false ]; then
    log_error "Build failed!"
    [ "$AMD64_OK" = false ] && log_error "  - AMD64 build failed"
    [ "$ARM64_OK" = false ] && log_error "  - ARM64 build failed"
    exit 1
fi

log_success "Both architecture builds completed!"
echo ""

# Create multi-arch manifest
log_info "Creating multi-arch manifest..."
echo ""

docker manifest rm "$IMAGE_NAME:$TAG" 2>/dev/null || true

docker manifest create "$IMAGE_NAME:$TAG" \
    --amend "$IMAGE_NAME:$AMD64_TAG" \
    --amend "$IMAGE_NAME:$ARM64_TAG"

docker manifest annotate "$IMAGE_NAME:$TAG" "$IMAGE_NAME:$AMD64_TAG" --arch amd64 --os linux
docker manifest annotate "$IMAGE_NAME:$TAG" "$IMAGE_NAME:$ARM64_TAG" --arch arm64 --os linux

log_success "Manifest created"
echo ""

log_info "Pushing manifest to registry..."
if docker manifest push "$IMAGE_NAME:$TAG"; then
    echo ""
    log_success "Multi-arch image published successfully!"
    echo ""
    echo -e "${BLUE}Image:${NC} $IMAGE_NAME:$TAG"
    echo ""
    echo "Individual tags:"
    echo "  - $IMAGE_NAME:$AMD64_TAG"
    echo "  - $IMAGE_NAME:$ARM64_TAG"
    echo ""
    echo "Verify:"
    echo "  docker manifest inspect $IMAGE_NAME:$TAG"
    echo ""
    echo "Deploy:"
    echo "  docker run -p 3000:3000 $IMAGE_NAME:$TAG"
else
    log_error "Failed to push manifest"
    exit 1
fi
