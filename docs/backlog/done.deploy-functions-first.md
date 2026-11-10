# Deploy the backend before the site on merge
**Phase**: — · **Deps**: —

## Goal
The merge workflow publishes Hosting first, then Firestore rules and Cloud Functions, so for a
few minutes a new client can call an old function (#174: a closure-day series failed instead of
skipping). Deploy rules and functions first, Hosting last, so the order holds on every merge.

## Files
- `.github/workflows/firebase-hosting-merge.yml` (edited) — move the Hosting step after Cloud Functions
- `README.md` (edited) — CI deploy paragraph states the new order

## Acceptance
- [ ] `build_and_deploy` runs: build → Google Cloud auth → Firestore rules → Cloud Functions → Hosting.
- [ ] The README CI paragraph names that order and why.
- [ ] NOT: changes to `tag_release` or its `needs`.
- [ ] NOT: changes to which resources CI deploys (indexes and Storage rules stay manual).
- [ ] NOT: the `networkOrShell` timer and tests from #174 (left out: an uncleared 5 s timer fires once and does nothing visible).

## Verify
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/firebase-hosting-merge.yml'))"` → no error
- `npm run lint && npm run build` → green
- after merge: the Actions run shows Hosting as the last deploy step and succeeds; the live site loads

## Notes
Trade-off: a failed rules or functions deploy now also skips Hosting until the next green merge.
Before, the site went live anyway against an older backend, which is the riskier way round.
Hosting still uses its own service-account input, so it doesn't depend on the auth step's order.
