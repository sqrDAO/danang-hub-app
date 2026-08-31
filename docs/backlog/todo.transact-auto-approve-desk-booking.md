# Make desk auto-approval transactional
**Phase**: — · **Deps**: —

## Goal
`autoApproveDeskBooking` reads desk occupancy and writes `status: "approved"` outside a
transaction, so two bookings created for the same desk close together can both be
auto-approved past `capacity`. Wrap the read-and-decide-and-write in a transaction, the
same pattern `autoPromoteWaitlist` already uses for the equivalent waitlist race.

## Files
- `functions/index.js` (edited) — `autoApproveDeskBooking` (currently lines 1926-1970):
  move the `computeBookingAvailability` read and the `snap.ref.update({status: "approved"})`
  write inside a single `db.runTransaction`, re-reading the amenity's current bookings for
  the target window inside the transaction rather than trusting the pre-transaction read.

## Acceptance
- [ ] `autoApproveDeskBooking` performs its conflict check and its approval write inside one `db.runTransaction`.
- [ ] Two bookings created for the same desk, same overlapping window, at exactly `capacity` remaining spots: at most `capacity` of them end up `status: "approved"`; the rest stay `pending` and trigger the existing `notifyPendingBookingReview` path.
- [ ] Non-desk bookings and fixed-desk-plan bookings keep their existing auto-approve/no-conflict behavior unchanged.
- [ ] NOT: does not change the advisory nature of the client-side `checkBookingConflicts` callable or `firestore.rules`.

## Verify
- `npm run lint && npm run build` → green.
- `cd functions && npm run lint` → green.
- `firebase emulators:start`, then create two desk bookings for the same amenity/day/hour range via two concurrent `addDoc` calls (browser console or a short Node script against the emulator) on a desk with `capacity: 1`: confirm only one ends up `approved` and the other stays `pending`.
- regression: existing desk auto-approve flow for non-conflicting bookings (manual booking through `/member/bookings` on a free desk slot still auto-approves).

## Notes
Same bug class as PR #48's fix to `autoPromoteWaitlist` (`functions/index.js:2490-2521`) —
that transaction re-reads `attendees`/`waitlist`/`capacity` inside the transaction rather
than trusting the trigger's own before/after snapshot. Mirror that shape here.
