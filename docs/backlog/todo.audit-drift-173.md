# Triage dependency audit drift

## Goal
Resolve compatible dependency advisories in the app and Cloud Functions for [#173](https://github.com/sqrDAO/danang-hub-app/issues/173). Record remaining advisories and their upgrade constraints.

## Files
- `package-lock.json` — compatible dependency fixes
- `functions/package-lock.json` — compatible dependency fixes

## Acceptance
- [x] Apply npm audit fixes within existing dependency ranges.
- [x] Record remaining advisories after fixes.
- [x] Required lint, build and unit tests pass.

## Verify
- `npm audit --json` in both packages to compare remaining findings.
- `npm run lint` and `npm run build` pass.
- `npm test` passes.
- `npm --prefix functions run lint` passes.
- Load Functions exports and preview the built app.

## Results
- App audit reduced from 21 (12 high, 8 moderate, 1 low) to 11 (5 high, 6 moderate).
- Functions reduced from 12 (5 high, 7 moderate) to 6 moderate.
- App high findings share the Firebase gRPC chain, locked at grpc-js 1.9.16. npm proposes downgrading Firebase to 9.14.0 and rules-unit-testing to 2.0.7.
- App moderate findings include React Router (npm proposes v7), plus Workbox/glob/minimatch (npm proposes downgrading vite-plugin-pwa to 1.1.0).
- Functions moderate findings share google-gax/glob/minimatch and its rimraf/gaxios/gcp-metadata chain. Repeating compatible audit fix leaves all six findings.
- Existing manifest ranges and overrides are preserved. Future dependency migrations require their own scope and verification.
- App and Functions lint pass. Production build and PWA generation pass.
- Unit tests report 298 passed, 8 emulator-dependent tests skipped, zero failures.
- All 19 Functions exports load. Local production preview serves HTML and the generated service worker successfully.
- Authenticated browser and live backend flows were not exercised. Build reports unresolved Wolgen font URLs and large chunks.
