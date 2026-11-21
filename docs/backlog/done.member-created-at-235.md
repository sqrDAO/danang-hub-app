# Tolerant member creation-time sorting
**Phase**: — · **Deps**: —

## Goal
Fix [#235](https://github.com/sqrDAO/danang-hub-app/issues/235): a Firestore Timestamp in a member's createdAt must not break the admin roster. Keep newest-first ordering and retain members with missing or invalid creation dates.

## Files
- `src/utils/memberSort.js` (new) — compare supported creation dates chronologically.
- `src/services/members.js` (edited) — use the comparator for the fetched roster.
- `test/memberSort.test.js` (new) — mixed timestamp types, missing dates and stable ordering.

## Acceptance
- [ ] ISO strings and Firestore Timestamps sort newest first together.
- [ ] Missing creation dates do not remove members from the roster.
- [ ] Invalid creation dates sort after valid dates.
- [ ] Equal creation times preserve input order.
- [ ] NOT: rewrite member documents or add a Firestore orderBy constraint.

## Verify
- `node --test test/memberSort.test.js` → mixed-type roster sorts without throwing.
- `npm run lint` → no errors or warnings.
- `npm test` → no failures.
- `npm run build` → production build succeeds.
- `cd functions && npm run lint` → no errors.

## Notes
- Regression uses real Firebase Timestamp values and Timestamp-like objects through the production comparator; no production data changes.
