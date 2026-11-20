# Triage dependency audit drift
**Phase**: — · **Deps**: — · **Issue**: #173

## Goal
Apply the dependency advisory fixes that fit the current version ranges, in the app and in Cloud Functions (#173). Record what remains and why it needs a bigger upgrade.

## Files
- `package-lock.json` (edited) — compatible fixes; firebase 12.15.0 → 12.19.0, @firebase/rules-unit-testing 5.0.1 → 5.0.2
- `functions/package-lock.json` (edited) — compatible fixes; @grpc/grpc-js 1.14.4 → 1.14.7

## Acceptance
- [ ] App audit drops from 21 (12 high, 8 moderate, 1 low) to 11 (5 high, 6 moderate).
- [ ] Functions audit drops from 12 (5 high, 7 moderate) to 6 (moderate only).
- [ ] No advisory appears that wasn't on `main`.
- [ ] Every lockfile change stays within the existing `package.json` ranges.
- [ ] NOT: changes to `package.json`, `functions/package.json` or `overrides`.
- [ ] NOT: major upgrades or downgrades of firebase, react-router, vite-plugin-pwa or rules-unit-testing.

## Verify
- `npm ci && npm audit` → 11 vulnerabilities (5 high, 6 moderate)
- `cd functions && npm ci && npm audit` → 6 moderate
- `npm run lint && npm run build && npm test` → green (298 pass, 8 emulator-dependent skips)
- `npm run test:rules` → 80 pass (firebase and rules-unit-testing changed)
- `cd functions && npm run lint && node -e "console.log(Object.keys(require('./index.js')).length)"` → green, 19
- regression: after deploy, Google sign-in (ideally iOS Safari), wallet sign-in, one booking, one event approval, push opt-in

## Notes
- App highs all come from @grpc/grpc-js 1.9.16, pinned `~1.9.0` by @firebase/firestore. The browser bundle uses webchannel, so only the Node rules tests use it. npm's only fix is downgrading firebase to 9.14.0 or rules-unit-testing to 2.0.7.
- App moderates: react-router 6 (fix is v7), and glob/minimatch via workbox-build (npm proposes vite-plugin-pwa 1.1.0).
- Functions moderates: google-gax → glob/minimatch and rimraf → gaxios/gcp-metadata. A second `npm audit fix` changes nothing.
- Firebase 12.19 puts the HTTP status in `FunctionsError.message`. `code` and `details` are unchanged, so nothing that checks them is affected, but raw callable messages shown in the UI now include the status.
- Each remaining fix is a migration with its own issue and spec.
