# Stop showing unapproved events on the public pages
**Phase**: — · **Deps**: —

## Goal
`getUpcomingEvents()` merges `approved` + `pending` events and its callers filter by
date only, so a member's not-yet-reviewed event request renders on the public homepage
and public events page as a normal registerable card. Show approved events only on
anonymous-visitor surfaces.

## Files
- `src/services/events.js` (edited) — fix the `getUpcomingEvents` docstring (it claims
  a date filter the function does not do) and add an `{ includePending = false }`
  option; default excludes pending.
- `src/pages/Home.jsx` (edited) — `['upcomingEvents']` query uses the approved-only default.
- `src/pages/Events.jsx` (edited) — same; drop the stale "(approved and pending)"
  comment at line ~281.
- `src/pages/member/Events.jsx` (edited) — pass `includePending: true` so members keep
  seeing their own pending requests; use a distinct query key so the public cache is
  not shared.

## Acceptance
- [ ] An anonymous visitor on `/` sees no `status: 'pending'` event.
- [ ] An anonymous visitor on `/events` sees no `status: 'pending'` event.
- [ ] A signed-in member on `/member/events` still sees pending events, including their own.
- [ ] The member and public surfaces use different React Query keys.
- [ ] Past-events sections still read from `getApprovedEvents` unchanged.
- [ ] NOT: no change to `firestore.rules` (events stay publicly readable).
- [ ] NOT: no admin Events page changes.

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → logged out, submit nothing; a pending event seeded in the emulator is
  absent from `/` and `/events`
- `npm run dev` → logged in as the organizer of that pending event; it appears on
  `/member/events` with its pending badge
- regression: `?eventId=…&action=register` deep link from `/events` still resolves for
  an approved event

## Notes
Needs a product call first: is the public preview of pending events deliberate? The
comment at `src/pages/Events.jsx:281` suggests someone knew. If it *is* wanted, the
alternative scope is to keep pending events visible but label them and disable the
Register button — pick one before implementing.

Four callers each reimplement the date filter (`Home.jsx:187`, `Events.jsx:282`,
`member/Dashboard.jsx:327`, `member/Events.jsx:59`). Consolidating that is tempting
but out of scope here; leave it for a separate refactor.
