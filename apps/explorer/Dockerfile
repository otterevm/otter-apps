# Multi-stage build for OtterEVM Explorer
# Build context: repo root (../../ from this file)

# Stage 1: Build
FROM node:20-slim AS builder

# Build arguments for chain configuration (Vite embeds these at build time)
ARG VITE_TEMPO_ENV=custom
ARG VITE_CHAIN_NAME=Pakxe
ARG VITE_CHAIN_ID=7447
ARG VITE_RPC_URL=https://rpc.pakxe.otterevm.com/
ARG VITE_LOGO_URL=/logo.svg

# Make them available as environment variables during build
ENV VITE_TEMPO_ENV=$VITE_TEMPO_ENV
ENV VITE_CHAIN_NAME=$VITE_CHAIN_NAME
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID
ENV VITE_RPC_URL=$VITE_RPC_URL
ENV VITE_LOGO_URL=$VITE_LOGO_URL

# Install required tools
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy root package files first (for workspace)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files for workspace dependencies
COPY packages/rpc-utils/package.json ./packages/rpc-utils/
COPY apps/explorer/package.json ./apps/explorer/

# Install dependencies (ignore scripts to avoid postinstall issues)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Remove the node wrapper that causes issues
RUN rm -f /app/node_modules/.bin/node
RUN rm -rf /app/node_modules/node

# Copy source code
COPY packages/rpc-utils ./packages/rpc-utils/
COPY apps/explorer ./apps/explorer/
COPY biome.json ./

# Build the explorer app with environment variables
WORKDIR /app/apps/explorer
RUN pnpm exec vite build

# Stage 2: Production
FROM node:20-slim AS runner

# Install CA certificates for TLS connections
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install wrangler
RUN npm install -g wrangler && npm cache clean --force

# Copy built assets
COPY --from=builder /app/apps/explorer/dist ./dist

# Work from the server directory
WORKDIR /app/dist/server

# Set memory limit for Node.js (help prevent OOM)
ENV NODE_OPTIONS="--max-old-space-size=1536"
# Disable source maps to reduce memory usage
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Create startup script with restart logic
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting Explorer with memory limit: ${NODE_OPTIONS}"\n\
\n\
# Function to cleanup on exit\n\
cleanup() {\n\
    echo "Shutting down..."\n\
    kill -TERM "$child" 2>/dev/null || true\n\
    wait "$child" 2>/dev/null || true\n\
    exit 0\n\
}\n\
\n\
trap cleanup SIGTERM SIGINT\n\
\n\
while true; do\n\
    echo "Starting wrangler dev..."\n\
    \n\
    # Run wrangler dev with limited concurrency to reduce memory\n\
    wrangler dev --port 3000 --ip 0.0.0.0 --log-level warn &\n\
    child=$!\n\
    \n\
    # Wait for process\n\
    if wait "$child"; then\n\
        echo "Wrangler exited normally"\n\
        break\n\
    else\n\
        exit_code=$?\n\
        echo "Wrangler crashed with exit code $exit_code, restarting in 5 seconds..."\n\
        sleep 5\n\
    fi\n\
done\n\
' > /start.sh && chmod +x /start.sh

# Run with restart script
CMD ["/start.sh"]
