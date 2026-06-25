# Dependency major-version migrations (security)
**Phase**: — · **Deps**: —

## Goal
Upgrade firebase JS SDK 10→12 (client) and firebase-functions 4→7 (functions)
to clear the remaining open CVEs from the June 2025 dependency audit. Both are
major-version bumps with breaking API changes that require code review.

## Files
- `package.json` (edited) — bump `firebase ^10.7.1 → ^12`
- `src/services/firebase.js` (edited) — modular SDK import changes if any
- `src/services/*.js` (edited) — audit for removed/renamed SDK exports
- `functions/package.json` (edited) — bump `firebase-functions ^4.5.0 → ^7`
- `functions/index.js` (edited) — migrate v1 function definitions to v2 API
- `functions/.npmrc` (deleted) — no longer needed once functions supports admin@14

## Acceptance
- [ ] `npm audit` on client shows 0 high severity vulnerabilities
- [ ] `npm audit` on functions shows 0 moderate severity vulnerabilities
- [ ] `npm run build` produces a clean build with no new errors
- [ ] `npm run lint` stays at or below current `--max-warnings 45` baseline
- [ ] `cd functions && npm run lint` passes with no errors
- [ ] NOT: react, react-router-dom, date-fns, i18next major bumps in this PR

## Verify
- `cd functions && npm audit` → 0 vulnerabilities
- `npm audit` → 0 high severity
- `npm run build` → exits 0
- regression: booking flow, event flow, wallet auth (all touch Cloud Functions)

## Notes
**Client — firebase 10→12:**
- firebase 10 is the last version using the "compat" layer imports
  (`firebase/compat/*`); check `src/services/firebase.js` — if it already uses
  the modular API (`import { getFirestore } from 'firebase/firestore'`) there
  may be no changes needed
- `undici ≤6.26.0` is the root CVE — comes through `@firebase/auth`,
  `@firebase/firestore`, `@firebase/functions`, `@firebase/storage` in firebase 10

**Functions — firebase-functions 4→7:**
- All current functions use the v1 API:
  `functions.region(REGION).https.onCall(...)`,
  `.pubsub.schedule(...)`,
  `.firestore.document(...)`
- firebase-functions v5+ deprecates v1 in favor of v2
  (`onCall`, `onSchedule`, `onDocumentWritten` from `firebase-functions/v2/*`)
- v2 functions have different runtime config (memory, timeout) syntax
- firebase-functions@7.2.5 still only declares peer `firebase-admin ^11-13`;
  once a release declares `^14`, the `functions/.npmrc` shim can be removed

**Sequencing:** client firebase first (lower risk), then functions (v1→v2 API
rewrite is the larger change).
