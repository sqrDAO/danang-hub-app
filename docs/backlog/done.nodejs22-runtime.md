# Bump Cloud Functions runtime and CI to Node.js 22
**Phase**: — · **Deps**: —

## Goal
Node.js 20 runtime was deprecated by GCF on 2026-04-30 and is decommissioned
2026-10-30, after which deploys fail. Move the functions runtime and the CI
workflows to Node 22 (LTS) well before the deadline.

## Files
- `functions/package.json` (edited) — `engines.node "20" → "22"`
- `.github/workflows/firebase-hosting-merge.yml` (edited) — `node-version '20' → '22'`
- `.github/workflows/firebase-hosting-pull-request.yml` (edited) — `node-version '20' → '22'`

## Acceptance
- [ ] `functions/package.json` engines requests node 22
- [ ] Both CI workflows set up node 22
- [ ] Functions emulator loads all 11 definitions with the new engines value
- [ ] NOT: dependency version changes
- [ ] NOT: client `package.json` engines field added

## Verify
- `cd functions && npm run lint` → exits 0
- `firebase emulators:start --only functions` → "Loaded functions definitions"
  lists all 11 functions
- After merge: CI run on main is green and `firebase functions:list` shows
  runtime nodejs22

## Notes
firebase-functions@7 supports nodejs22. Runtime change is an in-place v2→v2
update — no delete/recreate needed; CI deploys it on merge. The PR-triggered
workflow only builds (hosting preview), so the node bump there just aligns the
build environment.
