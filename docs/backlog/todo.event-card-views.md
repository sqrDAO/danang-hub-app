# One event card + modal, shaped per viewer by a view config
**Phase**: — · **Deps**: event-detail-modal

## Goal
Replace the 8 separate event card renderers (admin, member mine/upcoming/past, home upcoming/past, member + admin dashboard) with one `EventCard` that shares a field model with `EventDetailModal`. Each card and modal picks a viewer view (`admin`, `organizer`, `member`) whose hide list controls both, so a card never shows an event field its modal hides.

## Files
- `src/components/event/eventFields.js` (new) — field ids, restricted set, `getVisibleFields(view)`, shared formatters (time range, host names, amenity name, web-link check)
- `src/components/event/eventViews.js` (new) — `EVENT_VIEWS`: the three viewer hide lists
- `src/components/event/EventCard.jsx` (new) — the one card: banner, title, badge, time, hosts line, attendees, teaser, rejection, venue warning, revision, `context` + `actions` slots, `compact` size, `onOpen` (modal) or `to` (navigate)
- `src/components/event/EventCard.css` (new) — card styles under a new `ecard-` class prefix
- `src/components/event/EventDetailModal.jsx` (renamed from `src/components/`) — takes `view` instead of `showAdminDetails`
- `src/components/event/EventDetailModal.css` (renamed from `src/components/`) — card-only rules moved to `EventCard.css`
- `src/components/event/OrganizerName.jsx` (new) — organizer name, a button only when `onShowHost` is passed
- `src/components/EventTitleButton.jsx` (deleted) — inlined into the `EventCard` title: a `Link` when the card navigates, else a button
- `src/utils/eventCardClick.js` (deleted) — `getCardOpenProps` moved into `EventCard.jsx`, its only caller
- `src/pages/admin/Events.jsx`, `src/pages/member/Events.jsx`, `src/pages/Home.jsx` (edited) — cards → `EventCard` + detail modal
- `src/pages/member/Dashboard.jsx`, `src/pages/admin/Dashboard.jsx` (edited) — display-only cards that navigate to the events page; their detail modal, card buttons and host profile modal removed
- `src/pages/Home.css`, `src/pages/admin/Events.css`, `src/pages/member/Events.css`, `src/pages/admin/Dashboard.css`, `src/pages/member/Dashboard.css` (edited) — drop rules the card replaced
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `eventCard` keys; drop keys this change leaves unused
- `test/eventFields.test.js` (new) — `getVisibleFields` rules

## Acceptance
- [ ] Admin, member mine/upcoming/past, home upcoming/past and both dashboards render `EventCard`
- [ ] Dashboards use the `compact` card size
- [ ] Admin events uses view `admin`; member "My events" uses `organizer`; member upcoming/past use `member`
- [ ] Their detail modal uses the same view as the card that opened it
- [ ] Home and member dashboard cards use `member`, admin dashboard `admin`
- [ ] A field in a view's `hide` list shows on neither the card nor the modal
- [ ] `venue` and `revision` show only in the `admin` view
- [ ] Attendee and waitlist counts show only in the `admin` and `organizer` views
- [ ] Card time line reads `<date> · <start> – <end>` when `duration` is set
- [ ] Card hosts line reads `<hosts> · by <organizer>`; organizer is a button only where the page passes `onShowHost`
- [ ] Card description is clamped to 2 lines
- [ ] Admin card shows a hall-not-linked warning only when `requestedAmenityId` is set and `linkedAmenityId` is not
- [ ] Status badge text is translated (no raw `pending`)
- [ ] Member dashboard card click and title link go to `/member/events`
- [ ] Admin dashboard card click and title link go to `/admin/events`
- [ ] Home card click and title button open the detail modal
- [ ] Home Register goes to `/member/events?action=register&eventId=<id>` when logged in
- [ ] Home Register opens the auth prompt when logged out; login returns to the register action
- [ ] Home Register is disabled and reads "Event Full" when the event is full
- [ ] Dashboard cards have no buttons and open no modal
- [ ] Admin and member events pages keep their action buttons and their behavior
- [ ] Card styles use only `ecard-` classes
- [ ] NOT: unrouted `src/pages/Events.jsx`
- [ ] NOT: changes to event data, services or Firestore

## Verify
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass, including `test/eventFields.test.js`
- `npm run dev:skipauth` → screenshot every card type at 1280px and 390px, dark and light
- `npm run dev:skipauth` → `/admin/events`: Approve/Reject/Promote/Edit/Delete work; venue warning on the pending event only
- `npm run dev:skipauth` → `/member/events`: Edit/Cancel request, Register/Unregister/Waitlist work; modal opens from card and title
- `npm run dev:skipauth` → `/`: modal opens from card and title; Register works
- `npm run dev:skipauth` → `/member`, `/admin`: card click and Tab+Enter on the title navigate as above
- regression: VI locale, host profile modal on events pages, amenity cards on `/` unchanged

## Notes
- CSS is global in Vite; `.event-card`, `.event-title`, `.event-info` etc. are defined differently in 5 files. Hence the `ecard-` prefix.
- Dashboards are display-only: to register, see details or manage, the user goes to the events page. Home keeps the events-page card (modal + Register).
- Card look unifies across pages (accepted): member-card background (admin loses glass), tighter padding, 1.2rem title, bold date row, plain red rejection line, left status border where status shows, dimmed past cards, hover lift without glow. Attendee counts are hidden from `member` (low portal sign-ups make "1 / 50" look empty).
- The `context`/`actions` slots are page-owned and outside the field model.
