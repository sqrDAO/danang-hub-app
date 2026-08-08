# Per-day amenity availability in BookingCalendar
**Phase**: — · **Deps**: —

## Goal
Support day-specific operating hours in `BookingCalendar` (e.g. event space: 18:00–22:00 on weekdays, 09:00–22:00 on weekends) using `getDefaultAvailability(amenity?.type)` and per-day availability bounds instead of a single shared time axis.

## Files
- `src/components/BookingCalendar.jsx` (edited) — derive per-day operating bounds, union grid hours, and render closed slots for hours outside a day's window.
- `src/utils/bookingRange.js` (edited) — flag slots outside day-specific operating hours as unavailable.
- `src/locales/en.json` (edited) — localize per-day operating hours header labels if needed.
- `src/locales/vi.json` (edited) — localize per-day operating hours header labels if needed.
- `test/bookingRange.test.js` (edited) — test per-day operating boundary slot status.

## Acceptance
- [x] `BookingCalendar` uses `getDefaultAvailability(amenity?.type)` for fallback values when `amenity` properties are unassigned.
- [x] On weekdays, event-space slots before 18:00 and after 22:00 render as closed (`unavailable`).
- [x] On weekends, event-space slots before 09:00 and after 22:00 render as closed (`unavailable`).
- [x] Standard amenities (desk, meeting room, podcast room) continue to display 09:00–18:00 Monday–Friday.
- [x] The overall grid height spans the union of operating hours across the displayed days.
- [x] NOT: change booking data model, firebase rules, or backend functions.

## Verify
- `npm run lint` → passes with no warnings.
- `npm run build` → succeeds.
- `npm test` → all tests pass.
