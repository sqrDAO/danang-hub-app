# Booking range picker
**Phase**: — · **Deps**: —

## Goal
Replace the member duration dropdown with a cell-based calendar range picker: members select a 30-minute cell and extend the end of the range by selecting later cells. Derive the booking duration from that range and keep the selection flexible to clear, shorten, or extend it without restarting the modal, while giving mobile users a date-first booking flow that fits a single-column phone layout.

## Files
- `src/pages/member/Bookings.jsx` (edited) — derive duration from the chosen range, validate only complete ranges before confirmation, and coordinate the mobile date-first step.
- `src/components/Layout.jsx` (edited) — hide the floating chatbot while the booking modal is open.
- `src/components/BookingCalendar.jsx` (edited) — model start/end selection, continuous availability, closing-time endpoints, and the selected mobile booking date.
- `src/components/BookingCalendar.css` (edited) — distinguish range states and keep the mobile single-column time grid within the viewport.
- `src/pages/member/Bookings.css` (edited) — present the mobile date carousel, contextual range-selection instructions, and summary.
- `src/locales/en.json` (edited) — localize range-picker labels and instructions.
- `src/locales/vi.json` (edited) — localize range-picker labels and instructions.
- `src/utils/bookingRange.js` (new) — keep range-selection transitions and continuous availability checks pure.
- `test/bookingRange.test.js` (new) — cover the range-picker state transitions and closing-boundary availability.

## Acceptance
- [ ] Clicking an available cell selects a 30-minute range; clicking a later cell on the same date extends the range through that cell.
- [ ] Clicking the selected cell clears the range; clicking an earlier available cell resets the selection to that 30-minute cell.
- [ ] A selected range can be shortened or extended without restarting the modal.
- [ ] The calendar exposes the amenity closing time as a valid end boundary.
- [ ] End candidates are disabled when the entire range would contain a past, unavailable, or fully booked interval.
- [ ] Duration is calculated from start and end, with no member duration dropdown.
- [ ] On mobile, opening the booking flow shows date selection before time-slot selection.
- [ ] The mobile date selector is a horizontally scrollable centered carousel.
- [ ] Mobile date navigation uses carousel scrolling without separate week-switch arrow controls.
- [ ] The selected date is centered and visually emphasized in the mobile carousel.
- [ ] Dates before today do not appear in the mobile carousel.
- [ ] Selecting a date advances to that date's single-column time-slot grid.
- [ ] Mobile booking controls fit the phone viewport without oversized layout or unintended page-level horizontal overflow.
- [ ] Mobile users can return to the date selector and change the booking date.
- [ ] The floating chatbot is hidden while the booking modal is open.
- [ ] Desktop week-view booking behavior remains unchanged.
- [ ] NOT: Change booking data shape, availability rules, fixed-desk booking, or admin booking.

## Verify
- `npm run lint` → passes with no warnings.
- `npm run build` → production build succeeds.
- `npm test` → existing tests pass.
- regression: verify first-cell selection, clear-selection, earlier-cell reset, range shortening/extending, closing-boundary, and blocked-intermediate range interactions.
- mobile regression: use a phone-sized viewport to verify the centered date carousel, date-first flow, single-column time grid, date switching, and absence of page-level horizontal overflow.
- desktop regression: verify the existing week-view layout and range interactions remain usable.
