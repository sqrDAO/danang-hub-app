# Delete the two no-op Cloud Functions
**Phase**: — · **Deps**: —

## Goal
`updateEventCapacity` fires on every `events` update — every registration and waitlist
change — to `console.log` "is now full", and `cleanupOldBookings` runs daily to log old
bookings it never deletes. Both cost invocations, and both promise behavior in the
README functions table that does not exist. Remove them.

## Files
- `functions/index.js` (edited) — delete `exports.updateEventCapacity`
  (lines ~1352–1371) and `exports.cleanupOldBookings` (lines ~1374–1403).
- `README.md` (edited) — drop both rows from the Cloud Functions table.
- `docs/knowledge/data-flow.md` (edited) — drop both from the Cloud Functions wiring
  table and any prose reference.

## Acceptance
- [ ] Neither export remains in `functions/index.js`.
- [ ] The README Cloud Functions table lists neither function.
- [ ] `docs/knowledge/data-flow.md` lists neither function.
- [ ] Every remaining `events` trigger (`notifyEventPendingReview`, `notifyEventStatusChange`, `autoPromoteWaitlist`) is untouched.
- [ ] NOT: do not implement booking archival as a substitute — if retention is wanted it gets its own spec.
- [ ] NOT: no change to `autoCheckoutExpiredBookings` or `cleanupPushNotificationMarkers`.

## Verify
- `cd functions && npm run lint` → exit 0
- `firebase deploy --only functions` → deploy plan shows both functions being deleted
  and no other function changed
- regression: `firebase emulators:start`, register for an event → `autoPromoteWaitlist`
  and the notification triggers still fire; no missing-function errors in the log

## Notes
Deploy will prompt to confirm function deletion — expected, not an error. Nothing reads
either function's return value, and neither writes to Firestore, so there is no data
migration.

If 30-day booking retention is actually wanted, note it as a follow-up spec rather than
folding it in here; deleting member booking history is a product decision, not a cleanup.
