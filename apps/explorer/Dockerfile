# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.9.0

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/explorer/package.json ./apps/explorer/
COPY apps/explorer/.env.example ./apps/explorer/
COPY apps/explorer/wrangler.jsonc ./apps/explorer/
COPY packages/ ./packages/

# Install dependencies (ignore postinstall scripts ที่ใช้ wrangler)
RUN cd apps/explorer && pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY apps/explorer/ ./apps/explorer/

# Build the app (ใช้ docker config)
WORKDIR /app/apps/explorer
ARG VITE_TEMPO_ENV=moderato
ENV VITE_TEMPO_ENV=${VITE_TEMPO_ENV}
RUN pnpm build:docker

# Production stage
FROM node:22-slim AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.9.0

# Copy package files for production dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/explorer/package.json ./apps/explorer/
COPY apps/explorer/.env.example ./apps/explorer/
COPY apps/explorer/wrangler.jsonc ./apps/explorer/
COPY packages/ ./packages/

# Install production dependencies only (ignore scripts)
RUN cd apps/explorer && pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built app from builder (.output จาก Nitro)
COPY --from=builder /app/apps/explorer/.output ./apps/explorer/.output
COPY --from=builder /app/apps/explorer/package.json ./apps/explorer/

WORKDIR /app/apps/explorer

ENV NODE_ENV=production
ENV PORT=3000
ENV NITRO_PORT=3000

# Expose port
EXPOSE 3000

# Start the server using Nitro output
CMD ["node", ".output/server/index.mjs"]
