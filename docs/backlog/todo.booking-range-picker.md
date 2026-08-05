# Booking range picker
**Phase**: — · **Deps**: —

## Goal
Replace the member duration dropdown with a two-point calendar range picker: members select a start time, then an end time, and the booking duration is derived from that range. Make the selection flexible to cancel or adjust either endpoint without restarting the modal.

## Files
- `src/pages/member/Bookings.jsx` (edited) — derive duration from the chosen range and validate only complete ranges before confirmation.
- `src/components/BookingCalendar.jsx` (edited) — model start/end selection, continuous availability, and closing-time endpoints.
- `src/components/BookingCalendar.css` (edited) — distinguish start, end, selected range, and unavailable range endpoints.
- `src/pages/member/Bookings.css` (edited) — present contextual range-selection instructions and summary.
- `src/locales/en.json` (edited) — localize range-picker labels and instructions.
- `src/locales/vi.json` (edited) — localize range-picker labels and instructions.
- `src/utils/bookingRange.js` (new) — keep range-selection transitions and continuous availability checks pure.
- `test/bookingRange.test.js` (new) — cover the range-picker state transitions and closing-boundary availability.

## Acceptance
- [ ] A first available slot selects the start time; a later slot on the same date selects the end time.
- [ ] Clicking a selected start cancels the range; clicking before a selected start moves the start time.
- [ ] A selected end can be removed or adjusted without discarding a valid start time.
- [ ] The calendar exposes the amenity closing time as a valid end boundary.
- [ ] End candidates are disabled when the entire range would contain a past, unavailable, or fully booked interval.
- [ ] Duration is calculated from start and end, with no member duration dropdown.
- [ ] NOT: Change booking data shape, availability rules, fixed-desk booking, or admin booking.

## Verify
- `npm run lint` → passes with no warnings.
- `npm run build` → production build succeeds.
- `npm test` → existing tests pass.
- regression: verify first-click, clear-start, earlier-start, adjust-end, closing-boundary, and blocked-intermediate range interactions.
