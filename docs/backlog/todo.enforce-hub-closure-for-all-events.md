# Enforce Hub closure dates for events without a requested amenity
**Phase**: — · **Deps**: —

## Goal
`getEventSpaceValidationError`, the only server-side closure check for events, only runs
when `reviewEvent` approves an event that also requested the Event Hall amenity. An event
submitted without an amenity request gets no closure check anywhere — client or server —
and can be approved and run on a day the Hub is declared closed, contradicting the
closures UI copy that claims all bookings and events are blocked on those dates.

## Files
- `functions/eventLifecycle.js` (edited) — extract the closure check out of
  `getEventSpaceValidationError` (currently lines 66-82) into a standalone helper (e.g.
  `getEventClosureError({eventDate, duration})`) that doesn't require an `amenity` argument,
  so it can run for every event regardless of `requestedAmenityId`.
- `functions/index.js` (edited) — `reviewEvent` (currently around lines 448-480): call the
  new closure helper unconditionally on approval, not only inside the
  `if (initialData.requestedAmenityId)` branch; reject approval with the existing closure
  error message if the event date falls in a declared closure window.
- `src/services/events.js` (edited) — apply the same closure check client-side before
  submitting an event create/edit, matching the pattern `src/pages/member/Bookings.jsx:379-386`
  already uses for bookings (checking `rangeOverlapsClosure` directly rather than relying on
  the advisory conflict-check wrapper).
- `src/pages/member/Events.jsx` (edited) — surface the existing closures notice (or a
  closure-specific inline error) on the event creation form, matching how bookings already
  show it.

## Acceptance
- [ ] `reviewEvent` rejects approval of any event (with or without a requested amenity) whose date falls within a declared closure window, with the existing closure error message.
- [ ] The member event creation/edit form blocks submission for a date in a declared closure window before the request ever reaches the server, matching the booking form's existing behavior.
- [ ] Events requesting the Event Hall amenity keep their existing closure + capacity + conflict validation unchanged.
- [ ] NOT: does not retroactively cancel events already approved for a now-closed date (matches PR #72's documented decision for bookings — admins are notified and cancel manually).

## Verify
- `npm run lint && npm run build` → green.
- `cd functions && npm run lint` → green.
- `firebase emulators:start`: declare a closure date, submit an event for that date with no requested amenity, confirm the client blocks it; submit via a direct callable invocation bypassing the client check, confirm `reviewEvent` still rejects approval server-side.
- regression: `test/eventLifecycle.test.js` and the existing Event Hall closure test coverage from PR #72 still pass.

## Notes
Bookings already have this exact client + server closure pattern (`rangeOverlapsClosure`
client-side, server-side check inside `checkBookingConflicts`/`checkSlotAvailability`) —
follow it rather than inventing a new shape for events.
