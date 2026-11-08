# Hide event hall from member My Bookings
**Phase**: — · **Deps**: —

## Goal
The event hall is booked through the Events flow, yet its card shows in the "Available Amenities" grid on My Bookings and only redirects to event creation. Drop `event-space` amenities from that grid so members see only amenities they book there.

## Files
- `src/pages/member/Bookings.jsx` (edited) — filter `type === 'event-space'` out of the grid's `availableAmenities`; delete the now-dead event-space redirect in `handleBookAmenity`

## Acceptance
- [ ] The My Bookings amenities grid shows no amenity with `type: 'event-space'`
- [ ] Desks and other amenity types still show in the grid
- [ ] `/member/bookings?amenityId=<event-space id>` still redirects to `/member/events?action=create&amenityId=<id>`
- [ ] NOT: no new amenity field (e.g. `bookable`) — `type` already says the amenity is booked via events
- [ ] NOT: Home, Events, Dashboard and admin pages unchanged

## Verify
- `npm run lint && npm run build && npm test` → all green
- `npm run dev`, log in as a member, open `/member/bookings` → no event hall card
- open `/member/bookings?amenityId=<event hall id>` → lands on the Events create form with the hall preselected
- regression: book a desk from the grid → booking modal opens as before

## Notes
Filter at the grid prop, not `bookableAmenities`: that list also feeds `useBookingForm`'s deep-link handling, which must still see the hall to redirect it.
