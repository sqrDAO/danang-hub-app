# Remove the dead browser-local availability helpers from the bookings service
**Phase**: — · **Deps**: —

## Goal
`getWeeklyAvailability` groups bookings by `toDateString()` and builds day windows and
slots with `setHours`, all in the browser's timezone rather than `Asia/Ho_Chi_Minh`, so
an admin outside the hub zone would get bookings on the wrong day. Nothing calls it, or
its siblings `getAvailabilityForDate` and `calculateAvailableSlots` (unused since the
initial commit), so delete all three instead of rewriting zone math nobody runs.

## Files
- `src/services/bookings.js` (edited) — delete `getAvailabilityForDate`,
  `getWeeklyAvailability`, and the private `calculateAvailableSlots` (lines 251–355,
  through the end of `calculateAvailableSlots`), including their leading comments.

## Acceptance
- [ ] `src/services/bookings.js` no longer defines `getAvailabilityForDate`,
      `getWeeklyAvailability`, or `calculateAvailableSlots`.
- [ ] No file under `src/` or `test/` references any of the three names.
- [ ] NOT: changing `checkBookingConflicts`, `computeBookingAvailability`, or any other
      live availability path — the callable in `functions/index.js` stays the source of
      truth for slot conflicts.
- [ ] NOT: rewriting the helpers on hub time — if a weekly view is needed later, it gets
      its own spec built on `src/utils/timezone.js` (`addHubDays`, `isSameHubDay`,
      `makeHubDateAtTime`) and the amenity's top-level `startHour`/`endHour`.

## Verify
- `grep -rnE "getWeeklyAvailability|getAvailabilityForDate|calculateAvailableSlots" src test`
  → no output.
- `npm run lint` → clean (no new unused-import warnings in `bookings.js`).
- `npm run build` → succeeds.
- `npm test` → existing suite unchanged.
- regression: `npm run dev`, member books an amenity and admin checks it in — both work
  as before.

## Notes
The deleted slot helper also hardcoded 08:00–22:00 for every amenity, which disagrees with
the 9–18 office / event-space hours in `src/services/amenities.js`; another reason not to
revive it as-is.
