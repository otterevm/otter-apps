# วิเคราะห์การ Merge main -> otter-exp

## สรุปความเสี่ยง: 🔴 สูง

หาก merge `main` เข้า `otter-exp` **Docker จะพังแน่นอน** เพราะ `main` ได้ลบ Docker support ออกไปแล้ว

---

## จำนวน Commits ที่ต่างกัน

| Branch | Commits ที่ต่างกัน |
|--------|-------------------|
| `main` (ไม่มีใน otter-exp) | 22 commits |
| `otter-exp` (ไม่มีใน main) | 35 commits |

---

## ไฟล์ที่จะเกิด Conflict หรือถูก Overwrite

### 1. 🔴 CRITICAL - Docker จะพัง

| ไฟล์ | สถานะใน main | ผลกระทบ |
|------|--------------|---------|
| `apps/explorer/package.json` | ❌ ลบ `build:docker`, `start:docker`, `@sentry/node`, `nitro` | Docker build ไม่ได้ |
| `apps/explorer/vite.docker.config.ts` | ❌ ไม่มีใน main | ถ้า merge อาจถูกลบ |
| `apps/explorer/src/index.server.docker.ts` | ❌ ไม่มีใน main | ถ้า merge อาจถูกลบ |
| `apps/explorer/Dockerfile` | 📝 มีแต่แตกต่าง (main ใช้ wrangler dev) | จะถูกแทนที่ |
| `apps/explorer/docker-compose.yml` | 📝 มีแต่แตกต่าง | จะถูกแทนที่ |

### 2. 🟡 ต้องระวัง - Code ที่แก้ไข

| ไฟล์ | สถานะ | ผลกระทบ |
|------|-------|---------|
| `apps/explorer/src/routes/_layout/receipt/$hash.tsx` | 📝 main ใช้ Cloudflare-specific code | Docker build ไม่ผ่าน |

**รายละเอียด:**
- `main`: ใช้ `import { env } from 'cloudflare:workers'` และ `import puppeteer from '@cloudflare/puppeteer'`
- `otter-exp`: ใช้ dynamic import รองรับทั้ง Cloudflare และ Node.js

### 3. 🟢 ไม่กระทบ Docker

- Favicon, Logo (branding changes)
- README, docs
- GitHub workflows
- API app (ไม่เกี่ยวกับ explorer)

---

## สิ่งที่ `main` ลบออกไป (ที่ `otter-exp` มี)

```diff
# package.json
- "dev:ottertestnet": "..."
- "build:docker": "..."
- "start:docker": "..."
- "@sentry/node": "catalog:"
- "nitro": "npm:nitro-nightly@latest"

# เปลี่ยน build script
- "build": "NODE_OPTIONS='--max-old-space-size=8192' vite build"
+ "build": "vite build"
```

---

## แนวทางการ Merge อย่างปลอดภัย

### วิธีที่ 1: Merge แล้วแก้ไขทีหลัง (แนะนำ)

```bash
# 1. Checkout otter-exp
git checkout otter-exp

# 2. Merge main (จะมี conflict หรือไม่มีก็ตาม)
git merge origin/main

# 3. แก้ไขไฟล์ที่ถูกลบ/overwritten
# - คืนค่า package.json (เพิ่ม build:docker, start:docker, @sentry/node, nitro)
# - คืนค่า vite.docker.config.ts
# - คืนค่า src/index.server.docker.ts
# - แก้ Dockerfile, docker-compose.yml ถ้าถูกแทนที่
# - แก้ receipt/$hash.tsx ให้รองรับทั้งสองแบบ

# 4. Commit
git add -A
git commit -m "merge: main into otter-exp and restore Docker support"
```

### วิธีที่ 2: Cherry-pick เฉพาะ commits ที่ต้องการ

```bash
# เลือก commits จาก main ที่ไม่กระทบ Docker
# เช่น เอาแค่ bug fixes, ไม่เอา commits ที่แก้ package.json

git checkout otter-exp
git cherry-pick <commit-hash-1>
git cherry-pick <commit-hash-2>
```

### วิธีที่ 3: Rebase otter-exp บน main (ยากสุด)

```bash
git checkout otter-exp
git rebase origin/main
# จะต้องแก้ conflict เยอะมาก
```

---

## Checklist ก่อน Merge

- [ ] สำรอง branch `otter-exp` ก่อน (สร้าง branch `otter-exp-backup`)
- [ ] ทดสอบ build Docker หลัง merge
- [ ] ตรวจสอบว่า `build:docker` script ยังอยู่
- [ ] ตรวจสอบว่า `vite.docker.config.ts` ยังอยู่
- [ ] ตรวจสอบว่า `src/index.server.docker.ts` ยังอยู่
- [ ] ตรวจสอบว่า `src/routes/_layout/receipt/$hash.tsx` รองรับ Node.js

---

## คำแนะนำ

**หากต้องการอัพเดต code จาก main:**

1. อย่า merge ทั้งหมด - main ได้ revert Docker ออกไปแล้ว
2. ควร cherry-pick เฉพาะ commits ที่จำเป็น (เช่น bug fixes, security patches)
3. หรือ merge แล้วต้องแก้ไขให้คืน Docker support ทันที

**หากไม่จำเป็น:** ควรแยก branch ไว้แบบนี้ ไม่ต้อง merge main เข้ามา
