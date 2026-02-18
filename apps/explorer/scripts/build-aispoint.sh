#!/bin/bash

# Build AISPoint Explorer multi-arch images
# Usage: ./build-aispoint.sh [amd64-server] [arm64-server]

set -e

AMD64_SERVER="${1:-${AMD64_HOST:-}}"
ARM64_SERVER="${2:-${ARM64_HOST:-}}"
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/otterevm/explorer}"
TAG="aispoint"
AMD64_TAG="${TAG}-amd64"
ARM64_TAG="${TAG}-arm64"
REPO_URL="${REPO_URL:-https://github.com/otterevm/otter-apps.git}"
BUILD_BRANCH="${BUILD_BRANCH:-aispoint-build}"

# SSH Configuration
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519-dokcer}"
SSH_USER="${SSH_USER:-root}"

# AISPoint Chain Configuration
VITE_CHAIN_NAME="AISPoint"
VITE_CHAIN_ID="7448"
VITE_RPC_URL="https://aispoint.otterevm.com/rpc"
VITE_EXP_URL="https://aispoint.otterevm.com"
VITE_NATIVE="AIS"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate
if [ -z "$AMD64_SERVER" ] || [ -z "$ARM64_SERVER" ]; then
    log_error "Server addresses required"
    echo "Usage: $0 [amd64-server] [arm64-server]"
    exit 1
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   AISPoint Explorer Multi-Arch Build                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Chain: $VITE_CHAIN_NAME (ID: $VITE_CHAIN_ID)"
log_info "Image Base: $IMAGE_NAME"
log_info "Tags: $TAG, $AMD64_TAG, $ARM64_TAG"
log_info "Branch: $BUILD_BRANCH"
echo ""

# Remote build function
remote_build() {
    local server=$1
    local arch=$2
    local arch_tag="${TAG}-${arch}"
    
    log_info "[$arch] Building on $server..."
    
    local remote_script="/tmp/build-aispoint-${arch}.sh"
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$server" "cat > $remote_script" << BUILD_SCRIPT
#!/bin/bash
set -e

ARCH="\$1"
TAG="\$2"
IMAGE_NAME="\$3"
ARCH_TAG="\${TAG}-\${ARCH}"

BUILD_DIR="/tmp/explorer-build-\$(date +%s)"
mkdir -p "\$BUILD_DIR"
cd "\$BUILD_DIR"

echo "[\$ARCH] Cloning repository..."
git clone --depth 1 --branch "$BUILD_BRANCH" "$REPO_URL" otter-apps
cd otter-apps

echo "[\$ARCH] Building with AISPoint config..."
docker buildx build --provenance=false \
    --build-arg VITE_CHAIN_NAME="$VITE_CHAIN_NAME" \
    --build-arg VITE_CHAIN_ID="$VITE_CHAIN_ID" \
    --build-arg VITE_RPC_URL="$VITE_RPC_URL" \
    --build-arg VITE_EXP_URL="$VITE_EXP_URL" \
    --build-arg VITE_NATIVE="$VITE_NATIVE" \
    --build-arg VITE_TEMPO_ENV=custom \
    -f apps/explorer/Dockerfile \
    -t "\$IMAGE_NAME:\$ARCH_TAG" \
    .

echo "[\$ARCH] Pushing \$IMAGE_NAME:\$ARCH_TAG..."
docker push "\$IMAGE_NAME:\$ARCH_TAG"

cd /
rm -rf "\$BUILD_DIR"

echo "[\$ARCH] Complete!"
BUILD_SCRIPT

    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$server" \
        "chmod +x $remote_script && bash $remote_script $arch $TAG $IMAGE_NAME; rm -f $remote_script"
}

# Start builds
log_info "Starting parallel builds..."
remote_build "$AMD64_SERVER" "amd64" &
AMD64_PID=$!
remote_build "$ARM64_SERVER" "arm64" &
ARM64_PID=$!

AMD64_OK=true
ARM64_OK=true

if ! wait $AMD64_PID; then AMD64_OK=false; fi
if ! wait $ARM64_PID; then ARM64_OK=false; fi

echo ""

if [ "$AMD64_OK" = false ] || [ "$ARM64_OK" = false ]; then
    log_error "Build failed!"
    exit 1
fi

log_success "Builds completed!"
echo ""

# Create manifest
log_info "Creating multi-arch manifest..."
docker manifest rm "$IMAGE_NAME:$TAG" 2>/dev/null || true

docker manifest create "$IMAGE_NAME:$TAG" \
    --amend "$IMAGE_NAME:${TAG}-amd64" \
    --amend "$IMAGE_NAME:${TAG}-arm64"

docker manifest annotate "$IMAGE_NAME:$TAG" "$IMAGE_NAME:${TAG}-amd64" --arch amd64
docker manifest annotate "$IMAGE_NAME:$TAG" "$IMAGE_NAME:${TAG}-arm64" --arch arm64

log_success "Manifest created"
log_info "Pushing manifest..."
docker manifest push "$IMAGE_NAME:$TAG"

echo ""
log_success "AISPoint Explorer published!"
echo ""
echo "Tags:"
echo "  - $IMAGE_NAME:$TAG"
echo "  - $IMAGE_NAME:${TAG}-amd64"
echo "  - $IMAGE_NAME:${TAG}-arm64"
