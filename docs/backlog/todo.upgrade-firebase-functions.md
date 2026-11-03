# Upgrade firebase-functions to 7.4.0
**Phase**: — · **Deps**: —

## Goal
`firebase deploy --only functions` warns that `firebase-functions` is outdated: the
lockfile resolves 7.2.5 while 7.4.0 is latest (issue #135). Bump it so the warning goes
away without changing any function's behavior.

## Files
- `functions/package.json` (edited) — `firebase-functions` range `^7.2.5` → `^7.4.0`
- `functions/package-lock.json` (edited) — resolves `firebase-functions` 7.4.0 (CI installs via `npm ci`)

## Acceptance
- [ ] `functions/package-lock.json` resolves `node_modules/firebase-functions` to 7.4.0.
- [ ] `functions/package.json` declares `firebase-functions` as `^7.4.0`.
- [ ] Functions emulator loads every function without errors.
- [ ] NOT: no other dependency is upgraded (`firebase-admin` `^14.0.0` is already a supported peer).
- [ ] NOT: no change to the `us-central1` region pin or trigger regions.
- [ ] NOT: no change to function source code.

## Verify
- `cd functions && npm ls firebase-functions` → `firebase-functions@7.4.0`
- `cd functions && npm run lint` → green
- `cd functions && npm run serve` → "Loaded functions definitions" lists all 19 exports, the 8 `onCall` functions initialize, no load errors (triggers/schedulers are skipped without the Firestore/Pub/Sub emulators)
- `npm run lint && npm run build && npm test` → green
- post-deploy (CI): deploy log no longer shows the "outdated version of firebase-functions" warning

## Notes
Release notes 7.3.0–7.4.0 checked. Only change touching our code: 7.3.0 validates literal
`timeoutSeconds` per trigger type; our one use (`functions/index.js`, scheduler, `300`) is
in range. 7.4.0 itself moves its `express` dep `^4` → `^5`, which is most of the
lockfile churn; our code never imports express and has no `onRequest` (only `onCall`,
scheduler, Firestore triggers), so `onCall` is the path the emulator check exercises.
The us-central1/asia-southeast1 trigger-region note in the deploy log is the
known region pin (CLAUDE.md) — out of scope.
