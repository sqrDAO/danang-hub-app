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
- `src/components/event/eventFields.js` (edited) — add `getEventVenueId`,
  `getVenuePayload`, `getEventSpaces`, `getDefaultEventSpace`; delete `isHallUnlinked`.
- `src/pages/member/Events.jsx`, `src/pages/admin/Events.jsx` (edited) — render the
  shared form; admin create no longer calls `createBooking`.
- `src/components/event/EventCard.jsx`, `EventCard.css`, `EventDetailModal.jsx` (edited) —
  drop the "not linked" warning; one Venue row instead of requested/linked rows.
- `functions/index.js` (edited) — `reviewEvent` only sets status (plus approval/rejection
  fields); `editOwnEvent` no longer touches bookings; delete `assertEventSlotFree`,
  `getActiveEventBookings`.
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
- [x] The event's current venue stays in the options even if unavailable or deleted.
- [x] Every save writes the venue to `requestedAmenityId` (empty when unticked).
- [x] Every edit clears `linkedAmenityId` and its start/end times.
- [x] The form reads the venue from `linkedAmenityId`, falling back to `requestedAmenityId` (legacy events).
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
- `grep -n "createBooking" src/pages/admin/Events.jsx` → no matches
- `grep -n 'where("eventId"' functions/index.js` → no matches
- `npm run dev` as member: box unticked, weekday 10:00 → submits pending, no venue
- same, ticked, Event Hall, weekday 10:00 → hours error, Submit disabled
- same, ticked, Saturday 10:00 → submits pending with `requestedAmenityId` set
- as admin: approve it → approved, no new doc in `bookings`; edit → box ticked, hall selected
- as admin: create with the hall → approved, no booking; untick and save → reopens unticked
- regression: reject with reason, member edit of an approved event returns to pending,
  banner required on create in both roles

## Notes
`requestedAmenityId` keeps its name to avoid a data migration; it is now simply the venue.
