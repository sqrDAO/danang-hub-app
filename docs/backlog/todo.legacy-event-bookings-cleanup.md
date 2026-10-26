# Clean up legacy Event Hall bookings left by event approval
**Phase**: — · **Deps**: —

## Goal
Events approved before #109 each created a `bookings` doc with an `eventId`; that cleanup path was removed, so those bookings can stay active forever and block the hall. Find and cancel the stale ones once.

## Files
- `functions/scripts/cancel-legacy-event-bookings.js` (new) — one-off admin script, dry-run by default

## Acceptance
- [ ] Dry run lists every booking with an `eventId` and status `pending`, `approved` or `checked-in`
- [ ] `--apply` sets status `cancelled` and `updatedAt` on those bookings whose event is rejected, past, or missing
- [ ] NOT: bookings of approved future events are changed without the dry-run listing being reviewed
- [ ] NOT: any Cloud Function or client code is edited

## Verify
- `firebase emulators:exec --project demo-danang-hub-legacy --only firestore "node functions/scripts/cancel-legacy-event-bookings.js"` → prints the count of matching bookings and writes nothing
- `firebase emulators:exec --project demo-danang-hub-legacy --only firestore "node functions/scripts/cancel-legacy-event-bookings.js --apply"` → matching bookings show `cancelled`
- `cd functions && npm run lint` → clean

## Notes
First step: verify against live Firestore that such bookings exist (query `bookings` where `eventId` is set and status is active); if none, close this spec without code.
