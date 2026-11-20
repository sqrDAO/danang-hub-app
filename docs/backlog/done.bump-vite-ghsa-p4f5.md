# Bump vite to 7.3.8 (GHSA-p4f5-76q4-ffq7)
**Phase**: — · **Deps**: —

## Goal
Upgrade the direct `vite` devDependency from 7.3.6 to 7.3.8, the 7.x fix for
GHSA-p4f5-76q4-ffq7 (issue #213). The dev server is not network-exposed here, so
this is defense in depth.

## Files
- `package.json` (edited) — `vite` range `^7.3.6` → `^7.3.8`
- `package-lock.json` (edited) — lockfile for the bump

## Acceptance
- [ ] `package.json` declares `vite` `^7.3.8`
- [ ] `npm ls vite --all` shows only `vite@7.3.8`
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] NOT: any lockfile change outside the `vite` entry
- [ ] NOT: `overrides` in `package.json`

## Verify
- `npm ci && npm ls vite --all` → every line is `vite@7.3.8` (deduped)
- `npm run lint && npm run build` → exit 0
- `npm test` → 0 failures
- regression: `npm run dev` serves the app at :3000
