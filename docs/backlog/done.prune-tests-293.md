# Prune tests that guard no behavior
**Phase**: — · **Deps**: — · **Issue**: #293

## Goal
Remove or rewrite tests that duplicate another test, assert private state or internal helpers, or derive their expected value from the code under test. Every remaining test should fail only when intended behavior regresses.

## Files
- `test/mcpOauth.test.js` (edited) — RFC 7636 PKCE vector; drop private counter/storage checks and duplicates of `mcp.test.js`
- `test/mcp.test.js` (edited) — go through `authenticate` / `handlers.check_availability` instead of `reserveRequest` / `assertRange`
- `test/eventImport.test.js` (edited) — keep only list/non-URL cover cases (`importedBanner.test.js` owns host checks)
- `test/eventFields.test.js` (edited) — hard-code the admin-only view instead of reading `allowRestricted`
- `test/registrants.test.js` (edited) — blank search compares rows, not array identity
- `test/chunkReload.test.js` (edited) — exercise `shouldReloadForStaleChunk`, not `isOptionalChunkError`
- `test/profilePushSync.test.js` (edited) — assert outcome, not callback order
- `test/appVersion.test.js` (edited) — drop the placeholder-values test
- `test/bookingCancellationNotice.test.js`, `test/hubClosures.test.js` (edited) — drop duplicate assertions
- `test/firestore-booking-cancel.rules.test.js` (edited) — drop duplicate pending-cancel test
- `functions/mcpTokens.js` (edited) — stop exporting `reserveRequest`
- `functions/mcpBookings.js` (edited) — stop exporting `assertRange`
- `src/utils/chunkReload.js` (edited) — `isOptionalChunkError` no longer exported

## Acceptance
- [ ] No test recomputes its expected value with the logic under test
- [ ] No test asserts rate-limit counter values or token storage collections
- [ ] `reserveRequest`, `assertRange` and `isOptionalChunkError` have no importers outside their own module
- [ ] NOT: any production behavior change

## Verify
- `npm test` → all pass (with `functions/node_modules` installed via `npm ci`)
- `npm run test:rules` → all pass
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → green
