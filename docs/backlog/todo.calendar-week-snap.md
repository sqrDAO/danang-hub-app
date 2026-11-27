# Booking calendar: no height snap when changing week
**Phase**: — · **Deps**: —

## Goal
Each week has its own bookings query key, so Prev/Next/Today swap the whole
calendar for a shorter skeleton and the booking modal height snaps. Keep the
previous week on screen while the next one loads, without offering stale cells.

## Files
- `docs/backlog/todo.calendar-week-snap.md` (new) — this spec.
- `src/components/BookingCalendar.jsx` (edited) — `placeholderData: keepPreviousData`;
  grid disabled while `isPlaceholderData`.

## Acceptance
- [ ] Prev/Next/Today keep the calendar on screen while the new week loads (no skeleton swap).
- [ ] The grid takes no clicks until the new week's bookings have loaded.
- [ ] The skeleton still shows on the very first load.
- [ ] NOT: never show a cell as free from another week's rows while it is clickable.

## Verify
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- `npm run dev:skipauth` → open Book Now, click Next, Next, Prev, Today: no
  `.calendar-skeleton` appears and the calendar height stays constant.
- regression: admin Assign booking calendar loads and selects a range as before.

## Notes
- The bookings window spans week −7 to +15 days, so the previous rows already
  cover a one-week step; only a far Today jump shows uncovered dates, and the
  grid is disabled then.
