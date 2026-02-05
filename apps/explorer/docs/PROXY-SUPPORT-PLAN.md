# Proxy Contract Support - Implementation Plan

## Summary

Add Etherscan-style proxy contract support to the explorer's Interact tab. When viewing a proxy contract, users can switch between interacting with the proxy's own ABI (e.g., `implementation()`, `admin()`) vs the implementation's ABI (e.g., `balanceOf()`, `transfer()`).

## Branch

`feat/proxy-interact-tabs` (based on PR #546)

## Current Status

### ✅ Completed

1. **PR #546 Foundation** - Proxy detection + implementation ABI loading
2. **Refactored to Etherscan-style tabs** - `InteractTabContent` now uses horizontal sub-tabs:
   - `[Read Contract] [Write Contract] [Read as Proxy] [Write as Proxy]`
   - Non-proxy contracts show only first 2 tabs
   - Proxy contracts show all 4 tabs
3. **Unit tests created** - 15 tests in `src/comps/Contract.test.tsx`, all passing

### 🚧 Remaining

1. **Take screenshots** for visual review
2. **Manual QA testing** with real proxy contracts
3. **Commit and push** the changes

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         InteractTabContent                        │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  InteractSubTabs:                                           │ │
│  │  [Read Contract] [Write Contract] [Read as Proxy] [Write as Proxy] │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ProxyBanner (only in "as Proxy" modes):                    │ │
│  │  "EIP-1967 Proxy • Implementation: 0x1234..."               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ContractReader or ContractWriter (based on mode)           │ │
│  │  - read/write modes: use proxyAbi                           │ │
│  │  - readProxy/writeProxy modes: use implAbi                  │ │
│  │  - All calls go to proxy address                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Key Files Changed

| File | Changes |
|------|---------|
| `src/comps/Contract.tsx` | Added `InteractMode` type, `InteractSubTabs` component, refactored `InteractTabContent` |
| `src/comps/Contract.test.tsx` | New file with 15 unit tests |
| `src/lib/domain/proxy.ts` | From PR #546: proxy detection logic |

## Mode Behavior

| Mode | ABI Used | Banner | Target Address |
|------|----------|--------|----------------|
| Read Contract | Proxy's own ABI | Hidden | Proxy |
| Write Contract | Proxy's own ABI | Hidden | Proxy |
| Read as Proxy | Implementation ABI | Shown | Proxy |
| Write as Proxy | Implementation ABI | Shown | Proxy |

## Test Contracts

- **Non-proxy**: `0x20c0000000000000000000000000000000000001` (TIP-20 AlphaUSD)
- **EIP-1967 Proxy**: `0x8354d80eea9978faa04c3b36771c1e8b9c3e9058` (on Presto testnet)

## Commands

```bash
# Run tests
cd apps/explorer && pnpm test -- --run

# Run dev server
cd apps/explorer && pnpm dev

# Type check
pnpm check:types

# Lint/format
pnpm check
```

## Next Steps

1. Start dev server: `cd apps/explorer && pnpm dev`
2. Take screenshots of the UI at:
   - Non-proxy: `http://localhost:3000/address/0x20c0000000000000000000000000000000000001?tab=interact`
   - Proxy: `http://localhost:3000/address/0x8354d80eea9978faa04c3b36771c1e8b9c3e9058?tab=interact`
3. Save screenshots to `/tmp/proxy-ui-screenshots/`
4. Commit changes and push branch
5. Open PR for review
