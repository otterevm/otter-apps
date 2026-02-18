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
ARG VITE_EXP_URL=
ARG VITE_NATIVE=OTTER

# Make them available as environment variables during build
ENV VITE_TEMPO_ENV=$VITE_TEMPO_ENV
ENV VITE_CHAIN_NAME=$VITE_CHAIN_NAME
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID
ENV VITE_RPC_URL=$VITE_RPC_URL
ENV VITE_LOGO_URL=$VITE_LOGO_URL
ENV VITE_EXP_URL=$VITE_EXP_URL
ENV VITE_NATIVE=$VITE_NATIVE

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

# Copy everything from builder (dependencies + build output)
COPY --from=builder /app .

# Clean unnecessary files to reduce image size
RUN npm cache clean --force && rm -rf /tmp/*

WORKDIR /app/apps/explorer

# Set production environment and memory limit
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=1024

# Expose port
EXPOSE 3000

# Run with wrangler
CMD ["npx", "wrangler", "dev", "--port", "3000", "--ip", "0.0.0.0", "--log-level", "warn"]
