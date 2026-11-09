# Hide event hall from member My Bookings
**Phase**: — · **Deps**: —

## Goal
The event hall is booked through the Events flow, yet its card shows in the "Available Amenities" grid on My Bookings and only redirects to event creation. Drop event-space amenities from that grid, point members to Events instead, and keep one shared event-space rule.

## Files
- `src/utils/bookingDeepLink.js` (edited) — export `isEventSpaceAmenity`, `eventCreatePath` and `bookingGridAmenities`
- `src/pages/member/Bookings.jsx` (edited) — grid uses `bookingGridAmenities`; `form.openForAmenity` redirects event spaces to Events; event-hall hint in the grid header
- `src/pages/member/Bookings.css` (edited) — hint link style
- `src/pages/Home.jsx` (edited) — use `isEventSpaceAmenity`
- `src/components/event/eventFields.js` (edited) — use `isEventSpaceAmenity`
- `src/locales/en.json`, `src/locales/vi.json` (edited) — hint copy
- `test/bookingDeepLink.test.js` (edited) — cover the new helpers

## Acceptance
- [ ] The My Bookings amenities grid shows no amenity with `type: 'event-space'`
- [ ] Desks and other amenity types still show in the grid
- [ ] `/member/bookings?amenityId=local-hall` still redirects to `/member/events?action=create&amenityId=local-hall`
- [ ] `form.openForAmenity` given an event space navigates to the Events create form instead of opening the booking modal
- [ ] When a bookable event space exists, the grid header shows a hint linking to `/member/events?action=create`
- [ ] When no bookable event space exists, the hint is hidden
- [ ] The `type === 'event-space'` check lives once, in `isEventSpaceAmenity`, for Bookings, `bookingDeepLink.js`, Home and `eventFields.js`
- [ ] NOT: no new amenity field (e.g. `bookable`) — `type` already says the amenity is booked via events
- [ ] NOT: Home amenity links change destination
- [ ] NOT: Events page behavior changes
- [ ] NOT: Dashboard changes
- [ ] NOT: admin pages change
- [ ] NOT: `firestore.rules` changes (member bookings on an event space stay rules-allowed, as before)
- [ ] NOT: `BookingCalendar.jsx` / `services/amenities.js` hours logic changes

## Verify
- `npm run lint && npm run build && npm test` → all green
- `VITE_SKIP_AUTH=true npm run dev`, open `/member/bookings` → no Event Hall card; hint under the section description
- click the hint → Events create form opens
- open `/member/bookings?amenityId=local-hall` → lands on the Events create form with the hall preselected
- regression: book a desk from the grid → booking modal opens as before
- regression: Home amenity cards → hall links to Events create, others to Bookings

## Notes
- Filter at the grid prop, not `bookableAmenities`: that list also feeds `useBookingForm`'s deep-link handling, which must still see the hall to redirect it.
- The calendar's `|| defaults.weekdayStartHour !== undefined` reads `getDefaultAvailability(amenity.type)`, which only has `weekdayStartHour` for `event-space`, so it is the same rule as `type === 'event-space'`.
