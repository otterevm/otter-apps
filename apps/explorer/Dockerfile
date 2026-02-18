# Multi-stage Dockerfile for Explorer - Runtime Config Support
# This image can be used with any blockchain by setting env variables at runtime

# ==========================================
# Stage 1: Build
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/explorer/package.json ./apps/explorer/
COPY apps/explorer/wrangler.jsonc ./apps/explorer/
COPY apps/explorer/.env.example ./apps/explorer/
COPY packages/ ./packages/

# Install dependencies (ignore postinstall scripts in build)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY apps/explorer/ ./apps/explorer/

# Build the application (generic build without chain-specific config)
WORKDIR /app/apps/explorer
RUN pnpm exec vite build

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-slim AS runner

WORKDIR /app

# Install wrangler globally
RUN npm install -g wrangler

# Copy built assets from builder
COPY --from=builder /app/apps/explorer/dist ./dist

# Set working directory for wrangler
WORKDIR /app/dist/server

# Runtime environment variables (can be overridden at runtime)
ENV NODE_OPTIONS=--max-old-space-size=1024
ENV VITE_CHAIN_NAME=OtterEVM
ENV VITE_CHAIN_ID=7447
ENV VITE_RPC_URL=
ENV VITE_EXP_URL=
ENV VITE_NATIVE=OTTER
ENV VITE_LOGO_URL=/logo.svg

# Expose port
EXPOSE 3000

# Start with wrangler dev for SSR (supports runtime env vars)
CMD ["wrangler", "dev", "--port", "3000", "--ip", "0.0.0.0", "--log-level", "warn"]
