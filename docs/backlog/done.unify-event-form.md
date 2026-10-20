# Unify the event form; an event's venue is one field
**Phase**: — · **Deps**: —

## Goal
Members and admins edit events through two unrelated forms that store the venue in
different fields, and approval creates an Event Hall booking that later edits drift away
from. Events only reach the Hub after ops agrees with the organizer, so the booking
protects nothing: share one form, keep the venue as one field, and stop booking.

## Files
- `src/components/event/EventFormModal.jsx` (new) — the member form, moved out of
  `src/pages/member/Events.jsx`, plus `isAdmin` (organizer select, admin copy) and
  `requireGuidelines` props.
- `src/components/event/EventFormModal.css` (new) — form styles moved from both pages' CSS.
- `src/utils/eventSpaceHours.js` (new), `test/eventSpaceHours.test.js` (new) — Event Hall hour
  rules moved out of `src/services/amenities.js`, now taking the selected venue.
- `src/components/event/eventFields.js` (edited) — add `getEventVenueId`,
  `getVenuePayload`, `getEventSpaces`, `getDefaultEventSpace`; delete `isHallUnlinked`.
- `src/pages/member/Events.jsx`, `src/pages/admin/Events.jsx` (edited) — render the
  shared form; admin create no longer calls `createBooking`.
- `src/components/event/EventCard.jsx`, `EventCard.css`, `EventDetailModal.jsx` (edited) — one Venue row, no warning.
- `functions/index.js` (edited) — `reviewEvent` only sets status; `editOwnEvent` no longer touches
  bookings; delete `assertEventSlotFree`, `getActiveEventBookings`.
- `functions/scripts/repro-reviewevent-race.js` (deleted) — it asserted approval creates a booking.
- `functions/eventLifecycle.js`, `test/eventLifecycle.test.js` (edited) — delete
  `getEventSpaceValidationError`, `getBookingWindow` and their tests.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — delete the old admin form keys
  and the linked/not-linked venue keys.
- `README.md`, `docs/knowledge/data-flow.md`, `docs/knowledge/organizer-event-edit-verification.md`
  (edited) — events no longer book the hall.

## Acceptance
- [x] Member and admin pages both render `src/components/event/EventFormModal.jsx` for create and edit.
- [x] The "uses a Hub space" checkbox is visible and toggleable on create and edit, for both roles.
- [x] Unticking hides the parking notice, venue select and venue note.
- [x] With the box unticked, a member can submit an event dated a weekday at 10:00.
- [x] With the box ticked, the venue select is `required`.
- [x] With the box ticked, Event Hall hours and Hub closures block submit for both roles.
- [x] Ticking the box re-checks the date already entered.
- [x] Changing the venue re-checks the date against that venue's settings.
- [x] A venue's `isAvailable`, `availableDays`, `endHour` and weekend `startHour` narrow the policy window.
- [x] A venue's settings never widen the policy window.
- [x] The event's current venue stays in the options even if unavailable or deleted.
- [x] Every save writes the venue to `requestedAmenityId` (empty when unticked).
- [x] No code reads or writes `linkedAmenityId` or its start/end times.
- [x] Approving or rejecting an event creates, cancels or checks no booking.
- [x] Admin create creates no booking.
- [x] Event cards and the detail modal show one venue, and no "not linked" warning.
- [x] Organizer edits of approved/rejected events still return to pending; admin edits keep status.
- [x] The organizer select renders only for admins; the guidelines gate only on member create.
- [x] NOT: no meeting rooms in the venue list.
- [x] NOT: no change to `firestore.rules`.
- [x] NOT: existing event bookings in Firestore are not migrated or cancelled.

## Verify
- `npm run lint && npm run build && npm test` → all exit 0
- `cd functions && npm run lint` → exit 0
- `grep -n "createBooking" src/pages/admin/Events.jsx; grep -n 'where("eventId"' functions/index.js` → no matches
- `npm run dev` as member: box unticked, weekday 10:00 → submits pending, no venue
- same, ticked, Event Hall, weekday 10:00 → hours error, Submit disabled
- same, ticked, Saturday 10:00 → submits pending with `requestedAmenityId` set
- as admin: approve it → approved, no new doc in `bookings`; edit → box ticked, hall selected
- as admin: create with the hall → approved, no booking; untick and save → reopens unticked
- as admin: set the hall's end hour to 20; as member: hall, weekday 21:00 → venue hours error
- regression: reject with reason, member edit of an approved event returns to pending,
  banner required on create in both roles

## Notes
`requestedAmenityId` keeps its name to avoid a data migration; it is now simply the venue.

Decided with the product owner (2026-10-17): events never book the Event Hall, because
ops agrees each event with its organizer, and the admin approving it is the check.
- Venue type, hours and closures are validated in the form only; the server does not re-check them,
  so a crafted write can store any amenity id as the venue.
- A venue's `isAvailable`, `availableDays`, `endHour` and weekend `startHour` narrow the Hub policy
  (weekdays from 18:00, weekends 9:00–22:00) but never widen it (2026-10-20).
- Old event bookings are never cancelled, including when those events are edited or rejected; they expire on their own.
- Overlapping events are allowed; ops resolves them when agreeing the event.
- Events created before this change are decorative only (2026-10-19), so their `linkedAmenity*`
  fields and bookings are ignored, not cleaned up; an old admin-created event shows no venue.
