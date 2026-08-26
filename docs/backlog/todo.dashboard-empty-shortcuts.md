# Dashboard shortcuts to book and create an event
**Phase**: — · **Deps**: —

## Goal
The member dashboard tracking cards dead-end on empty copy. Add always-visible shortcuts that jump to Book Now and Create Event so a member can act from `/member` without hunting through nav.

## Files
- `src/pages/member/Dashboard.jsx` (edited) — Book Now on upcoming bookings header; Create Event beside View all on upcoming events.
- `src/pages/member/Dashboard.css` (edited) — header action cluster.
- `src/pages/member/Events.jsx` (edited) — `/member/events?action=create` opens the create modal even without `amenityId`.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — dashboard Create Event label.
- `README.md` (edited) — one Member Portal line for the shortcuts.

## Acceptance
- [ ] `/member` upcoming-bookings header always shows a Book Now control that navigates to `/member/bookings`.
- [ ] `/member` upcoming-events header always shows a Create Event control that navigates to `/member/events?action=create`.
- [ ] Empty upcoming-bookings copy is the existing no-upcoming message only (no second Book Now).
- [ ] Empty upcoming-events copy is the existing no-upcoming message only (no second Create Event).
- [ ] `/member/events?action=create` opens the member create-event modal and strips the query param.
- [ ] `/member/events?action=create&amenityId=<id>` still prefills that Event Hall amenity.
- [ ] Existing View all on upcoming events still goes to `/member/events` with no modal.
- [ ] Both `en.json` and `vi.json` carry the new dashboard key.
- [ ] NOT: do not auto-open the booking modal from the dashboard (no amenity is selected yet).
- [ ] NOT: do not add these shortcuts on the admin dashboard.

## Verify
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- `npm run dev` → `/member` with no upcoming bookings/events: header Book Now lands on `/member/bookings`; header Create Event opens the create modal on `/member/events`; empty copy has no second button; View all does not open the modal.
- regression: book an amenity from `/member/bookings`; open create from the Events page header (no query param).

## Notes
- Book Now reuses `common.bookNow`. Create Event is a dashboard key so the small header button is not the Events page "+ Create Event" label.
