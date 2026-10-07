# Unit-test waitlist promotion detection
**Phase**: — · **Deps**: —

## Goal
`autoPromoteWaitlist` decides who was "newly promoted" with inline set logic (PR #86) that guards against spoofed notifications, but nothing in `npm test` covers it. Extract it as a pure helper and test the spoof case.

## Files
- `functions/waitlist.js` (new) — `getNewlyPromoted(before, after)` pure function
- `functions/index.js` (edited) — call the helper from `autoPromoteWaitlist`
- `test/waitlist.test.js` (new) — cases below

## Acceptance
- [ ] `getNewlyPromoted` returns a uid moved from `waitlist` to `attendees` in the same write
- [ ] `getNewlyPromoted` returns nothing for an attendees-only add of a uid still on `waitlist`
- [ ] `getNewlyPromoted` returns nothing for a uid that joined `attendees` without being on `waitlist`
- [ ] `getNewlyPromoted` tolerates missing `attendees` / `waitlist` arrays
- [ ] NOT: changing notification copy, dedup subject ids, or promotion transaction behavior

## Verify
- `node --test test/waitlist.test.js` → all pass
- `cd functions && npm run lint` → clean
- `npm test` → all pass
