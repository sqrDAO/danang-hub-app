# Faster PR CI: short SMTP test timeout, parallel jobs, cached node_modules
**Phase**: — · **Deps**: —

## Goal
PR CI takes 85-125s because one unit test waits out a real 20s SMTP socket timeout, the PR workflow runs its two jobs in series, and every job re-runs `npm ci` (#258). Shorten that test's timeout, run the PR jobs in parallel, and cache `node_modules` so PR CI drops to roughly 45-55s.

## Files
- `test/emailTransport.test.js` (edited) — stalled-socket test overrides `socketTimeout` to 500ms and asserts production still passes 20000
- `.github/actions/setup-deps/action.yml` (new) — composite action: setup-node 22, cache `node_modules` + `functions/node_modules`, `npm ci` only on a miss
- `.github/workflows/firebase-hosting-pull-request.yml` (edited) — both jobs use setup-deps; `build_and_preview` drops `needs: checks`
- `.github/workflows/rules-tests.yml` (edited) — uses setup-deps
- `.github/workflows/firebase-hosting-merge.yml` (edited) — `build_and_deploy` uses setup-deps

## Acceptance
- [ ] `npm test` finishes in under 5s locally
- [ ] The stalled-socket test still asserts the third send retries on one fresh connection and is delivered
- [ ] The stalled-socket test asserts the getter passes `socketTimeout: 20000` to the transport factory
- [ ] `checks` and `build_and_preview` start in parallel on a PR
- [ ] The cache key is runner OS + Node version + hash of `package-lock.json` and `functions/package-lock.json`
- [ ] The cache step has no `restore-keys`
- [ ] On a cache hit, no job runs `npm ci`
- [ ] On a cache miss, both the root and `functions/` installs run `npm ci`
- [ ] Every workflow job that installs deps uses `.github/actions/setup-deps`
- [ ] NOT: `functions/emailTransport.js` timeouts change
- [ ] NOT: the merge workflow's build and deploy steps change
- [ ] NOT: any secret is added or changed

## Verify
- `npm test` → all pass, duration_ms under 5000
- `npm run lint` → clean
- `npm --prefix functions run lint` → clean
- `npm run build` → succeeds
- PR first run → setup-deps cache miss, `npm ci` runs, all checks green
- PR second run (new commit or re-run) → setup-deps cache hit, install steps skipped, all checks green
- regression: "Firestore rules tests" check still passes

## Notes
- No `restore-keys`: a partial `node_modules` restore followed by a skipped `npm ci` would leave stale or missing packages.
- Accepted cost of parallel jobs: a PR that fails lint still deploys a throwaway preview channel. Merge stays gated on both checks.
- setup-node `cache: 'npm'` is dropped: on a miss `npm ci` refills from the network, and on a hit it is never used.
