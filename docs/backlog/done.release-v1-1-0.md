# Release v1.1.0
**Phase**: — · **Deps**: app-version

## Goal
Release v1.1.0 with member-facing notes for everything merged since v1.0.0. The booking confirmation leads; the merge tags the release.

## Files
- `package.json`, `package-lock.json` (edited) — `version` 1.0.0 → 1.1.0
- `CHANGELOG.md` (edited) — `## v1.1.0` section above v1.0.0

## Acceptance
- [ ] `package.json` `version` is `1.1.0`
- [ ] `package-lock.json` root `version` is `1.1.0`
- [ ] `CHANGELOG.md` has a `## v1.1.0` section above `## v1.0.0`
- [ ] The section names #136, #148, #151, #152, #153, #154, #156, #160, #162, #164, #165, #169, #171, #190, #191 and #199
- [ ] The booking pass is described as a booking confirmation, not a building access ticket
- [ ] The notes say the Profile email is locked to the sign-in email
- [ ] The notes say new email/password sign-ups verify their email before using the Hub
- [ ] The notes say older accounts can verify from Profile, optionally
- [ ] The notes say event status emails are always sent, only to a verified sign-in email
- [ ] The notes say wallet accounts get event updates in the bell, and as push only on phones with notifications on, never by email
- [ ] The section is signed Th0dium
- [ ] NOT: #131, #147, #132 or #146 get a line (unverified speed claim; invisible; admin-only)
- [ ] NOT: #175, #176, #192, #193 or #198 get a line (docs, process or deploy order only)
- [ ] NOT: #189 or #194 get a line (#199 removed #189's switch states; #194 is a refactor)
- [ ] NOT: the notes mention a Profile "Send verification link" button or an Email notifications switch members can turn on
- [ ] NOT: no change to the v1.0.0 section
- [ ] NOT: no git tag pushed by hand

## Verify
- `node -p "require('./package.json').version"` → `1.1.0`
- `awk -v v="v1.1.0" '$0 ~ "^## " v "( |$)" {on=1; next} /^## v/ {on=0} on' CHANGELOG.md` → the v1.1.0 notes only, ending at the signature
- `npm run lint && npm run build && npm test` → green
- After merge: `gh release view v1.1.0` → notes match the v1.1.0 section
- After merge: `git ls-remote --tags origin v1.1.0` → points at this PR's merge commit
- After deploy: the live footer shows `v1.1.0` with the merge commit's short hash

## Notes
Merge this before any other PR that changes what members see, so the tag lands on exactly the code these notes describe. If the merge date isn't 2026-11-13, update the heading date first.
