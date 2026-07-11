# Fix crash on legacy string startTime/endTime in booking capacity checks
**Phase**: — · **Deps**: desk-auto-approve

## Goal
`computeBookingAvailability` (functions/index.js) assumes every booking doc's `startTime`/`endTime` is a Firestore Timestamp and calls `.toDate()` unconditionally. A past migration (`functions/migrate-bookings-hours.js`) wrote ~51 existing booking docs back with plain ISO strings instead of Timestamps, so any query that touches one of those docs throws `TypeError: booking.startTime.toDate is not a function`. This currently makes the new `autoApproveDeskBooking` trigger fail on every invocation (confirmed via `firebase functions:log`) — desk bookings never get auto-approved — and has likely been silently degrading `checkBookingConflicts`/`checkSlotAvailability` (whose client wrappers swallow errors as "no conflicts") since that migration ran.

## Files
- `functions/index.js` (edited) — in `computeBookingAvailability`'s snapshot loop (~line 209-210), read `startTime`/`endTime` defensively: use `.toDate()` when it's a function, otherwise `new Date(value)`, so both Timestamp and legacy-string docs work

## Acceptance
- [ ] `computeBookingAvailability` no longer throws when a matched booking doc has string `startTime`/`endTime`
- [ ] A new desk booking with capacity remaining is created `pending` and promoted to `approved` by `autoApproveDeskBooking` even when other bookings on that amenity include legacy string-timestamp docs
- [ ] `checkBookingConflicts`/`checkSlotAvailability` return correct `hasConflicts`/`available` values against legacy string-timestamp docs (no silent `{hasConflicts: false}` fallback triggered by the crash)
- [ ] NOT: no backfill/rewrite of the legacy booking docs themselves — this is a read-side fix only

## Verify
- `cd functions && npm run lint` → green
- `npm run lint && npm run build` → green
- `firebase functions:log --only autoApproveDeskBooking` after a fresh member desk booking → no `TypeError`, doc flips to `approved`
- regression: fixed-desk plan bookings and non-desk amenity bookings still stay `pending` as before
