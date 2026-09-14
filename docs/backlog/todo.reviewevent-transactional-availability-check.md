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
- `test/eventLifecycle.test.js` or a new `test/reviewEventConcurrency.test.js` (edited or
  new) — cover the re-check logic if it can be unit-tested as a pure function; the
  concurrent-race itself needs emulator coverage (see Verify).

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
- Emulator: with `firebase emulators:start`, create two pending events requesting the same
  Event Hall amenity for overlapping times, then fire two `reviewEvent` approval calls
  back-to-back (e.g. via `Promise.all` in a one-off script or `firebase functions:shell`)
  → exactly one booking is created; the second call receives `failed-precondition`.
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
