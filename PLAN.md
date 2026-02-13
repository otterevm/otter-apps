# Implementation Plan: `apps/accounts`

Based on [AUTH_PLAN.md](../AUTH_PLAN.md). Tasks within the same phase can run in parallel.

---

## Phase 1: Scaffold `apps/accounts` worker

### 1a. Project boilerplate

Create `apps/accounts/` with standard files matching existing apps (e.g. `fee-payer`):

- `package.json` — deps: `hono`, `@hono/zod-validator`, `zod`, `drizzle-orm`, `ox`, `nanoid`; devDeps: `wrangler`, `@cloudflare/workers-types`, `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`, `drizzle-kit`
- `tsconfig.json` — copy from `fee-payer`, add `env.d.ts` + `worker-configuration.d.ts` to `files`
- `env.d.ts` — declare `CloudflareBindings` with `DB` (D1), `SESSION_PRIVATE_KEY`, `SESSION_PUBLIC_KEY`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `OTP_EMAIL_RATE_LIMITER`, `OTP_IP_RATE_LIMITER`
- `wrangler.jsonc` — name `accounts`, `main: ./src/index.ts`, D1 binding `DB` → `accounts-db`, rate limit bindings for `OTP_EMAIL_RATE_LIMITER` (5 req/min) and `OTP_IP_RATE_LIMITER` (20 req/min), envs for production (`accounts.tempo.xyz` route, `accounts-db`) and preview (workers.dev, `accounts-db-preview`)
- `.env.example`
- `drizzle.config.ts` — follow `contract-verification` pattern, schema at `./src/db/schema.ts`

### 1b. DB schema (`src/db/schema.ts`)

Port the 4 tables from `tempoxyz/app` using drizzle-orm/sqlite-core:

| Table | Source |
|-------|--------|
| `users` | `app/src/lib/server/db/tables/users.ts` |
| `wallets` | `app/src/lib/server/db/tables/wallets.ts` |
| `challenges` | `app/src/lib/server/db/tables/challenges.ts` |
| `email_otps` | `app/src/lib/server/db/tables/email-otps.ts` |

Copy schemas verbatim. Add `src/db/ids.ts` (port `createId` with `nanoid`).

### 1c. DB client + repo (`src/db/repo.ts`)

- `src/db/client.ts` — simple `drizzle(env.DB)` using Hono context bindings (no `getServerConfig` indirection)
- `src/db/repo.ts` — port `emailAuthRepo` from `app/src/lib/server/email-auth/repo.ts`. Accept `db` as parameter instead of calling `getDrizzleDb()`. Port `challengeStore` from `challenge-store.ts` into same file or separate `src/db/challenge-store.ts`.

---

## Phase 2: Core modules (parallel)

### 2a. Session module (`src/session.ts`)

Rewrite session signing from HMAC-SHA256 to **Ed25519**:

- `signSession(privateKey, payload)` → `base64url(payload).base64url(ed25519_signature)`
  - payload: `{ sub: userId, sid: sessionId, iat, exp }` (exp = 1 year)
  - Import Ed25519 private key via `crypto.subtle.importKey('jwk', ...)`
  - Sign with `crypto.subtle.sign('Ed25519', ...)`
- `verifySession(publicKey, cookie)` → parse, verify signature, check exp
- `sessionCookieHeaders(userId, hostname)` → mint `__Secure-session` cookie with `Domain=.tempo.xyz; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
- `clearSessionCookieHeaders()` → clear all cookie variants (secure, host, dev, legacy)
- `getSessionUserId(request)` → parse cookie, verify Ed25519 with public key

### 2b. CORS middleware (`src/cors.ts`)

Custom CORS middleware (not Hono's built-in, need hostname validation):

1. Parse `Origin` header
2. Validate: `hostname === 'tempo.xyz'` OR (`hostname.endsWith('.tempo.xyz')` AND `hostname.split('.').length <= 4`)
3. Dev mode: also allow `http://localhost:*`
4. Echo `Access-Control-Allow-Origin: <origin>`, `Access-Control-Allow-Credentials: true`
5. Allow methods `GET, POST`, headers `Content-Type`
6. Handle `OPTIONS` → 204

### 2c. Rate limiting (`src/rate-limit.ts`)

Port from `app/src/lib/server/email-auth/rate-limit.ts`. Adapt to use Hono context bindings instead of dynamic `import('cloudflare:workers')`.

---

## Phase 3: Route handlers (parallel)

### 3a. Auth routes (`src/routes/auth.ts`)

Hono route group with 4 endpoints. Port logic from `app/src/pages/_api/auth/`:

| Endpoint | Source | Notes |
|----------|--------|-------|
| `POST /auth/send-otp` | `send-otp.ts` | Rate limit → generate OTP → hash → store in D1 → send via Mailgun |
| `POST /auth/verify-otp` | `verify-otp.ts` | Verify hash → upsert user → mint Ed25519 session cookie |
| `GET /auth/session` | `session.ts` | Verify cookie → return user + wallets |
| `POST /auth/sign-out` | `sign-out.ts` | Clear session cookie |

Key changes from source:
- Use Ed25519 session signing (not HMAC)
- Use Hono `c.json()` / `c.req` patterns
- Get bindings from Hono context (`c.env.DB`, `c.env.MAILGUN_API_KEY`, etc.)
- `hashCode` and `generateOtp` helpers can be inlined or extracted to a util

### 3b. Wallet routes (`src/routes/wallets.ts`)

Hono route group with 5 endpoints. Port from `app/src/pages/_api/wallets/`:

| Endpoint | Source | Notes |
|----------|--------|-------|
| `POST /wallets/register` | `register.ts` | Auth required → generate challenge → store in D1 → return WebAuthn options |
| `POST /wallets/verify` | `verify.ts` | Auth required → validate challenge → derive address from pubkey → store wallet |
| `GET /wallets/by-credential` | `by-credential.ts` | Look up wallet by credential ID → return user + wallets + mint session |
| `GET /wallets/credential-key` | `credential-key.ts` | Auth required → return public key hex for credential |
| `POST /wallets/rename` | `rename.ts` | Auth required → update wallet label |

Key changes:
- Port `getRpId()` from `app/src/lib/rp-id.ts` inline or as `src/rp-id.ts`
- Use `ox/Hex` for hex operations (already in existing apps' deps)

---

## Phase 4: Wire up entrypoint (`src/index.ts`)

- Create Hono app
- Apply CORS middleware (from 2b)
- Mount auth routes at `/auth/*`
- Mount wallet routes at `/wallets/*`
- Export default app

---

## Phase 5: Tests

### 5a. Unit tests

- `src/session.test.ts` — Ed25519 sign/verify round-trip, expired cookie rejection, tampered signature rejection
- `src/cors.test.ts` — valid origins pass, invalid origins blocked, `evil-tempo.xyz` blocked, localhost allowed in dev

### 5b. Integration tests

- `test/auth.test.ts` — full OTP flow (send → verify → session → sign-out) using `@cloudflare/vitest-pool-workers`
- `test/wallets.test.ts` — register → verify → by-credential → credential-key → rename

---

## Phase 6: Deploy & migrate (sequential)

1. `pnpm install` from root
2. Create D1 databases: `wrangler d1 create accounts-db` + `accounts-db-preview`
3. Run drizzle migrations: `drizzle-kit push`
4. Generate Ed25519 key pair, set as worker secrets (`SESSION_PRIVATE_KEY`, `SESSION_PUBLIC_KEY`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`)
5. Deploy preview → test on workers.dev
6. Seed `accounts-db` from `app-db-presto` (users, wallets, challenges, email_otps tables)
7. Deploy production → `accounts.tempo.xyz`

---

## Phase 7: Update `tempoxyz/app` (separate PR, after accounts is live)

### 7a. Client-side fetch URL changes

- `EmailAuthProvider.tsx` — all `fetch('/auth/...')` and `fetch('/wallets/...')` → `fetch('https://accounts.tempo.xyz/...', { credentials: 'include' })`
- `src/lib/key-manager.ts` — `getPublicKey` fetch → `accounts.tempo.xyz`
- `src/lib/auth.ts` — `signOut` fetch → `accounts.tempo.xyz`
- Add `ACCOUNTS_URL` env var for preview/dev configurability

### 7b. SSR session verification

- Rewrite `getSessionUserIdFromCookie` in `session.ts` to use Ed25519 **public key** verification instead of HMAC
- Add `SESSION_PUBLIC_KEY` env var to app worker

### 7c. Delete dead code

Remove all 9 API route handlers (`_api/auth/*`, `_api/wallets/*`), `repo.ts`, `rate-limit.ts`, `challenge-store.ts`, and cookie minting from `session.ts`.

---

## Parallelism summary

```
Phase 1a ─┐
Phase 1b ─┼─► Phase 2a ─┐
Phase 1c ─┘   Phase 2b ─┼─► Phase 4 ─► Phase 5 ─► Phase 6
              Phase 2c ─┤
              Phase 3a ─┤
              Phase 3b ─┘

Phase 7 (after Phase 6 is deployed)
```

Phases 2a/2b/2c/3a/3b are all independent once the scaffold (Phase 1) is in place. Phase 3 routes depend on the modules from Phase 2 only at import time, so they can be written concurrently and wired together in Phase 4.
