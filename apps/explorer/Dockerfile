# Multi-stage build for OtterEVM Explorer
# Build context: repo root (../../ from this file)

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

# Build the explorer app
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

# Expose port
EXPOSE 3000

# Run
CMD ["wrangler", "dev", "--port", "3000", "--ip", "0.0.0.0"]
