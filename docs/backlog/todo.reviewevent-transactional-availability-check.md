# Move reviewEvent's Event Hall availability check inside its transaction
**Phase**: — · **Deps**: —

## Goal
Close a real double-booking race: `reviewEvent`'s Event Hall availability check runs
before the transaction that creates the linked booking, so two concurrent approvals for
overlapping-time events can both pass the check and both book the same slot.

## Files
- `functions/index.js` (edited) — re-check amenity/time availability for
  `requestedAmenityId` inside the `db.runTransaction` in `reviewEvent`, using the same
  transaction's reads, immediately before `tx.create`ing the linked booking.
- `functions/scripts/repro-reviewevent-race.js` (new) — a one-off Node script, run only
  against the emulator (see Verify), that seeds two pending events requesting the same
  Event Hall amenity for an overlapping time window and fires two concurrent `reviewEvent`
  admin approvals via `Promise.all`, printing how many bookings exist for that amenity/
  window afterward. Not part of `npm test` (`test/*.test.js` is pure-helper-only per
  CLAUDE.md) — this needs live Firestore transactions to reproduce the race at all.

## Acceptance
- [ ] `reviewEvent`'s transaction re-reads bookings scoped to `requestedAmenityId` and the
      computed `[startTime, endTime)` window (not just `eventId`) before creating the
      linked booking, and aborts the approval with `failed-precondition` if an active
      (`pending`/`approved`/`checked-in`) booking already occupies an overlapping slot.
- [ ] Two `reviewEvent` calls approving different pending events that request the same
      Event Hall slot cannot both succeed — the second call throws
      `failed-precondition` and creates no booking.
- [ ] The pre-transaction `computeBookingAvailability` check (`functions/index.js:467-478`)
      stays in place as a fast-fail for the common case; it does not replace the
      in-transaction re-check.
- [ ] NOT: this does not add a global slot-lock mechanism or change the advisory nature of
      `checkBookingConflicts` for member-facing booking creation — it only closes the gap
      in the one path (`reviewEvent`) CLAUDE.md and `data-flow.md` already describe as
      atomic.

## Verify
- `npm run lint && cd functions && npm run lint` → both clean.
- `npm run build` → production build succeeds.
- `npm test` → existing tests pass.
- `firebase emulators:exec --only firestore,functions "node functions/scripts/repro-reviewevent-race.js"`
  → the script reports exactly one booking created for the contested amenity/window, and
  logs that the second `reviewEvent` call rejected with `failed-precondition`.
- regression: re-run the existing organizer-edit-event emulator matrix
  (`docs/knowledge/organizer-event-edit-verification.md`) to confirm normal single-approval
  Event Hall bookings still succeed.

## Notes
The transaction already re-reads the event doc for the revision check
(`functions/index.js:481`) and queries `bookings where eventId == eventId`
(`:507-509`) to find bookings tied to *this* event for cancellation bookkeeping — that
query is intentionally narrow and should stay; the new check is a second, separate
transactional read scoped to amenity+time, mirroring what `computeBookingAvailability`
already does outside the transaction.
