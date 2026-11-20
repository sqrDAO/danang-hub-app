# Run required checks on pull requests
**Phase**: — · **Deps**: — · **Issue**: #179

## Goal
Catch app lint, unit-test and Functions lint failures on a pull request, before merge (#179). The preview deploy waits for those checks, so a broken PR never gets a preview.

## Files
- `.github/workflows/firebase-hosting-pull-request.yml` (edited) — new `checks` job; `build_and_preview` gets `needs: checks`

## Acceptance
- [ ] Every PR runs `npm run lint`, `npm test` and `npm run lint` in `functions/`.
- [ ] The checks job runs on PRs from forks too.
- [ ] The checks job has `contents: read` only and uses no secrets.
- [ ] The checks job installs both lockfiles with `npm ci` on Node 22.
- [ ] `build_and_preview` runs only after `checks` succeeds.
- [ ] NOT: `pull_request_target` (fork code must never run with secrets).
- [ ] NOT: changes to `firebase-hosting-merge.yml` or `rules-tests.yml`.

## Verify
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/firebase-hosting-pull-request.yml'))"` → no error
- `npm ci && npm run lint && npm test && npm run build` → green (298 pass, 8 emulator-dependent skips)
- `cd functions && npm ci && npm run lint` → green
- on the PR: the "Lint and unit tests" check passes, then `build_and_preview` runs

## Notes
- Merging is only blocked once "Lint and unit tests" is a required status check on `main` (GitHub → Settings → Branches). That is a repo setting, done by an admin, not by this PR.
- The checks job doesn't build; same-repo PRs build in `build_and_preview`. Fork PRs get no preview, so their build isn't checked.
- Existing build warnings (unresolved Wolgen font URLs, large chunks) are unchanged.
