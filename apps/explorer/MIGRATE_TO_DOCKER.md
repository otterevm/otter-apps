# Migrate OtterEVM Explorer to Docker

เอกสารนี้สรุปการแก้ไขเพื่อรัน OtterEVM Explorer บน Docker (Node.js) แทน Cloudflare Workers

## ไฟล์ที่สร้างใหม่

1. **vite.docker.config.ts** - Vite config สำหรับ Docker (ใช้ Nitro แทน Cloudflare)
2. **src/index.server.docker.ts** - Server entry สำหรับ Node.js
3. **Dockerfile** - Multi-stage build
4. **docker-compose.yml** - Docker Compose configuration

## ไฟล์ที่แก้ไข

5. **src/routes/_layout/receipt/$hash.tsx** - แก้ให้รองรับทั้ง Cloudflare และ Node.js
6. **package.json** - เพิ่ม scripts และ dependencies
7. **pnpm-workspace.yaml** - เพิ่ม @sentry/node ใน catalog

---

## วิธีใช้งาน

### Build & Run ด้วย Docker Compose

```bash
cd apps/explorer
docker-compose up --build -d
```

### Build แล้ว Run ด้วย Node.js โดยตรง

```bash
cd apps/explorer
pnpm install
pnpm build:docker
PORT=3000 node .output/server/index.mjs
```

---

## ความแตกต่างหลัก

| | Cloudflare Workers | Docker (Node.js) |
|---|---|---|
| **Build Command** | `pnpm build` | `pnpm build:docker` |
| **Output** | `dist/` | `.output/` |
| **Start Command** | `wrangler deploy` | `node .output/server/index.mjs` |
| **Server Engine** | Cloudflare Workers | Nitro (Node.js) |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_TEMPO_ENV` | `moderato` | Environment (devnet, testnet, moderato, presto, ottertestnet) |
| `PORT` | `3000` | Port ที่จะรัน server |
| `VITE_BASE_URL` | - | Base URL ของแอป |
| `SENTRY_DSN` | - | Sentry DSN (optional) |

---

## Troubleshooting

### Build ไม่ผ่านเนื่องจาก `cloudflare:workers`

ตรวจสอบว่าใช้ `vite.docker.config.ts` ที่มี Nitro plugin แทน Cloudflare plugin

### PDF Generation ไม่ทำงานใน Docker

ต้องติดตั้ง Puppeteer ใน Dockerfile หรือใช้ browserless/chrome แยก

---

## การ Deploy บน Cloudflare (เดิม)

ยังคงใช้ได้ตามปกติ:

```bash
pnpm build
pnpm deploy
```
