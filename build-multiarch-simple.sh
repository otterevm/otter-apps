#!/bin/bash

# Simple multi-arch build using remote Docker contexts via SSH
# This builds natively on each architecture for better performance
#
# Prerequisites:
#   1. SSH access to both servers with docker installed
#   2. Docker logged into ghcr.io on all servers
#   3. SSH key configured
#
# Usage: ./build-multiarch-simple.sh [tag] [amd64-server] [arm64-server]

set -e

# Configuration
TAG="${1:-latest}"
AMD64_SERVER="${2:-${AMD64_HOST:-}}"
ARM64_SERVER="${3:-${ARM64_HOST:-}}"
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/otterevm/node}"
REPO_URL="${REPO_URL:-https://github.com/otterevm/node.git}"
BUILD_BRANCH="${BUILD_BRANCH:-otterevm}"

# SSH Configuration
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519-dokcer}"
SSH_USER="${SSH_USER:-root}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_usage() {
    echo "Multi-Architecture Docker Build for OtterEVM Node"
    echo ""
    echo "Usage:"
    echo "  $0 [tag] [amd64-server] [arm64-server]"
    echo ""
    echo "Environment Variables:"
    echo "  AMD64_HOST     - AMD64 server IP/hostname"
    echo "  ARM64_HOST     - ARM64 server IP/hostname"
    echo "  SSH_KEY        - Path to SSH key (default: ~/.ssh/id_ed25519-dokcer)"
    echo "  SSH_USER       - SSH username (default: root)"
    echo "  IMAGE_NAME     - Docker image name (default: ghcr.io/otterevm/node)"
    echo "  REPO_URL       - Git repository URL"
    echo "  BUILD_BRANCH   - Git branch to build (default: otterevm)"
    echo ""
    echo "Examples:"
    echo "  $0 latest 23.88.35.142 203.0.113.50"
    echo "  AMD64_HOST=amd64.example.com ARM64_HOST=arm64.example.com $0 v1.0.0"
    echo ""
}

# Parse arguments
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_usage
    exit 0
fi

# Validate
if [ -z "$AMD64_SERVER" ] || [ -z "$ARM64_SERVER" ]; then
    log_error "Server addresses required"
    show_usage
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    log_error "SSH key not found: $SSH_KEY"
    log_info "Set SSH_KEY environment variable or place key at default location"
    exit 1
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Multi-Architecture Docker Build - OtterEVM         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Configuration:"
echo "  Image:    $IMAGE_NAME:$TAG"
echo "  AMD64:    $SSH_USER@$AMD64_SERVER"
echo "  ARM64:    $SSH_USER@$ARM64_SERVER"
echo "  Branch:   $BUILD_BRANCH"
echo ""

# Test SSH connections
echo "Testing SSH connections..."
if ! ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$SSH_USER@$AMD64_SERVER" "echo 'AMD64 OK'" &>/dev/null; then
    log_error "Cannot connect to AMD64 server"
    exit 1
fi
log_success "AMD64 server reachable"

if ! ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$SSH_USER@$ARM64_SERVER" "echo 'ARM64 OK'" &>/dev/null; then
    log_error "Cannot connect to ARM64 server"
    exit 1
fi
log_success "ARM64 server reachable"
echo ""

# Remote build function
remote_build() {
    local server=$1
    local arch=$2
    local arch_tag="${TAG}-${arch}"
    
    log_info "[$arch] Starting build on $server..."
    
    # Create build script on remote server
    local remote_script="/tmp/build-otter-${arch}-$(date +%s).sh"
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$server" "cat > $remote_script" << 'BUILD_SCRIPT'
#!/bin/bash
set -e

ARCH="$1"
TAG="$2"
IMAGE_NAME="$3"
REPO_URL="$4"
BUILD_BRANCH="$5"
ARCH_TAG="${TAG}-${ARCH}"

BUILD_DIR="/tmp/otter-build-$(date +%s)"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

echo "[$ARCH] Building in $BUILD_DIR..."

# Clone repo
echo "[$ARCH] Cloning $REPO_URL ($BUILD_BRANCH)..."
git clone --depth 1 --branch "$BUILD_BRANCH" "$REPO_URL" otter
cd otter

# Build Docker image
echo "[$ARCH] Building Docker image..."
docker build -f Dockerfile.otter -t "$IMAGE_NAME:$ARCH_TAG" .

# Push to registry
echo "[$ARCH] Pushing $IMAGE_NAME:$ARCH_TAG..."
docker push "$IMAGE_NAME:$ARCH_TAG"

# Cleanup
cd /
rm -rf "$BUILD_DIR"

echo "[$ARCH] Build complete!"
BUILD_SCRIPT

    # Execute build script remotely
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$server" \
        "chmod +x $remote_script && $remote_script $arch $TAG $IMAGE_NAME $REPO_URL $BUILD_BRANCH; rm -f $remote_script"
}

# Start parallel builds
log_info "Starting parallel builds..."
echo ""

remote_build "$AMD64_SERVER" "amd64" &
AMD64_PID=$!
remote_build "$ARM64_SERVER" "arm64" &
ARM64_PID=$!

# Wait and capture status
AMD64_OK=true
ARM64_OK=true

if ! wait $AMD64_PID; then
    AMD64_OK=false
fi

if ! wait $ARM64_PID; then
    ARM64_OK=false
fi

echo ""

# Check results
if [ "$AMD64_OK" = false ] || [ "$ARM64_OK" = false ]; then
    log_error "Build failed!"
    [ "$AMD64_OK" = false ] && log_error "  - AMD64 build failed"
    [ "$ARM64_OK" = false ] && log_error "  - ARM64 build failed"
    exit 1
fi

log_success "Both architecture builds completed!"
echo ""

# Create manifest locally
log_info "Creating multi-arch manifest..."
echo ""

# Remove old manifest if exists
docker manifest rm "$IMAGE_NAME:$TAG" 2>/dev/null || true

# Create manifest
docker manifest create "$IMAGE_NAME:$TAG" \
    --amend "$IMAGE_NAME:${TAG}-amd64" \
    --amend "$IMAGE_NAME:${TAG}-arm64"

# Annotate
docker manifest annotate "$IMAGE_NAME:$TAG" "$IMAGE_NAME:${TAG}-amd64" --arch amd64 --os linux
docker manifest annotate "$IMAGE_NAME:$TAG" "$IMAGE_NAME:${TAG}-arm64" --arch arm64 --os linux

log_success "Manifest created"
echo ""

# Push manifest
log_info "Pushing manifest to registry..."
if docker manifest push "$IMAGE_NAME:$TAG"; then
    echo ""
    log_success "Multi-arch image published successfully!"
    echo ""
    echo -e "${BLUE}Image:${NC} $IMAGE_NAME:$TAG"
    echo ""
    echo "Architectures:"
    echo "  ✓ linux/amd64 (from $AMD64_SERVER)"
    echo "  ✓ linux/arm64 (from $ARM64_SERVER)"
    echo ""
    echo "Verify:"
    echo "  docker manifest inspect $IMAGE_NAME:$TAG"
    echo ""
    echo "Pull:"
    echo "  docker pull $IMAGE_NAME:$TAG"
else
    log_error "Failed to push manifest"
    exit 1
fi
