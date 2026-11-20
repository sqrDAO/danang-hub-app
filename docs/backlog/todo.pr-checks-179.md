# Run required checks on pull requests

## Goal
Catch app lint, unit-test and Functions lint failures before merge for [#179](https://github.com/sqrDAO/danang-hub-app/issues/179).

## Files
- `.github/workflows/firebase-hosting-pull-request.yml` — add a checks job and require it before preview deployment.

## Acceptance
- [ ] Every PR runs app lint, unit tests and Functions lint, including forks.
- [ ] Checks install both locked dependency trees with Node 22.
- [ ] Preview deployment waits for successful checks.

## Verify
- Parse the workflow YAML and inspect job dependencies and permissions.
- `npm run lint`, `npm test`, `npm --prefix functions run lint`, and `npm run build` pass.
- Inspect GitHub checks after opening the PR.

## Results
- YAML parsing and assertions confirm the PR trigger, read-only checks job, commands and preview dependency.
- Clean npm installs succeed for both packages.
- App lint, Functions lint, build and PWA generation pass.
- Unit tests report 298 passed, 8 emulator-dependent tests skipped, zero failures.
- Build reports existing unresolved Wolgen font URLs and large chunks.
