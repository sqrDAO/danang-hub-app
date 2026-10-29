# Run the Firestore rules tests in CI
**Phase**: — · **Deps**: —

## Goal
CI deploys `firestore.rules` to production on every merge, but the emulator-backed rules tests (`test/*.rules.test.js`) skip unless an emulator is running, and no workflow starts one. Add a CI job that runs them against the Firestore emulator on every PR and push to `main`.

## Files
- `.github/workflows/rules-tests.yml` (new) — Node 22 + Java 21, cached emulator, `npm run test:rules`
- `package.json` (edited) — `test:rules`: pinned `firebase-tools` `emulators:exec` over the rules test files, one file at a time
- `README.md` (edited) — `npm run test:rules` in Available Commands
- `CLAUDE.md` (edited) — `npm run test:rules` in Commands and Checks

## Acceptance
- [ ] Every pull request runs the rules tests against the Firestore emulator
- [ ] Every push to `main` runs the rules tests against the Firestore emulator
- [ ] A failing rules test fails the job
- [ ] The job needs no secrets, so it runs on fork PRs too
- [ ] `npm run test:rules` works locally with the same command CI runs
- [ ] Rules test files run one at a time (`--test-concurrency=1`), so they never share an emulator project concurrently
- [ ] NOT: the deploy workflows are unchanged
- [ ] NOT: this check is not made required on `main` here (branch protection is a repo setting)

## Verify
- `npm run test:rules` → all rules tests pass locally
- PR for this branch → "Firestore rules tests" check runs and passes
- regression: "Deploy to Firebase Hosting on PR" still runs and passes

## Notes
- `firebase-tools` is pinned (15.25.1) in the script and the emulator cache key; bump both together.
