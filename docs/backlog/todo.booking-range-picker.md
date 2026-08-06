# Booking range picker
**Phase**: — · **Deps**: —

## Goal
Replace the member duration dropdown with a cell-based calendar range picker: members select a 30-minute cell and extend the end of the range by selecting later cells. Derive the booking duration from that range and keep the selection flexible to clear, shorten, or extend it without restarting the modal, while giving mobile users a date-first booking flow that fits a single-column phone layout.

## Files
- `src/pages/member/Bookings.jsx` (edited) — derive duration from the chosen range, validate only complete ranges before confirmation, and coordinate the mobile date-first step.
- `src/components/Layout.jsx` (edited) — hide the floating chatbot while the booking modal is open; localize its label and take its icon color from CSS.
- `src/components/Layout.css` (edited) — read the floating chatbot colors from custom properties.
- `src/components/BookingCalendar.jsx` (edited) — model start/end selection, continuous availability, closing-time endpoints, and the selected mobile booking date, all on the hub calendar day.
- `src/components/BookingCalendar.css` (edited) — distinguish range states, keep hour guides visible in both themes, and keep the mobile single-column time grid within the viewport.
- `src/pages/member/Bookings.css` (edited) — present the mobile date carousel, contextual range-selection instructions, and summary.
- `src/components/Modal.jsx` (edited) — accept a `footer` and `className`, and restore the previous body overflow on close.
- `src/components/Modal.css` (edited) — style the compact booking modal and its footer.
- `src/styles/globals.css` (edited) — add the `--tg-float-bg` / `--tg-float-icon` custom properties.
- `src/locales/en.json` (edited) — localize range-picker labels, instructions, and the chatbot label.
- `src/locales/vi.json` (edited) — localize range-picker labels, instructions, and the chatbot label.
- `src/utils/bookingRange.js` (new) — keep range-selection transitions and continuous availability checks pure.
- `src/utils/timezone.js` (edited) — fix `parseHubDateTime`'s offset detection and add the hub calendar-day helpers the calendar builds cells from.
- `.eslintrc.cjs` (edited) — give `test/**` the Node env so the suite can set `process.env.TZ`.
- `test/bookingRange.test.js` (new) — cover the range-picker state transitions and closing-boundary availability.
- `test/timezone.test.js` (edited) — cover the hub-day helpers and `parseHubDateTime` under a non-hub browser timezone.

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
- [ ] Cells, day boundaries, and weekday availability resolve on the `Asia/Ho_Chi_Minh` calendar, not the browser's.
- [ ] The hours label names the amenity's own available days instead of a hardcoded Mon–Fri.
- [ ] NOT: Change booking data shape, availability rules, fixed-desk booking, or admin booking.

## Verify
- `npm run lint` → passes with no warnings.
- `npm run build` → production build succeeds.
- `npm test` → 18 tests pass, 0 fail.
- `TZ=America/Los_Angeles npm test` → same result; the hub helpers ignore the local zone.
- `TZ=Pacific/Auckland npm test` → same result from a zone ahead of the hub.
- `npm run dev:booking` → open the modal, select 09:00–10:30, and confirm the summary and the persisted `startTime` are 09:00–10:30 hub time.
- regression: verify first-cell selection, clear-selection, earlier-cell reset, range shortening/extending, closing-boundary, and blocked-intermediate range interactions.
- mobile regression: use a phone-sized viewport to verify the centered date carousel, date-first flow, single-column time grid, date switching, and absence of page-level horizontal overflow.
- desktop regression: verify the existing week-view layout and range interactions remain usable.
- theme regression: toggle light and dark and confirm the hour guides stay visible in both.
- event regression: create an event from `/member/events` and confirm its saved time matches the entered hub time (`parseHubDateTime` changed).
