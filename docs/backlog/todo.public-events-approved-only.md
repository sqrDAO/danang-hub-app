# Stop showing unapproved events on the public pages
**Phase**: — · **Deps**: —

## Decision (settled 2026-07-25)
Pending events **must not** preview publicly. Approved-only on every anonymous-visitor
surface; members keep seeing pending events on `/member/events`. The label-and-disable
alternative was considered and rejected. The Acceptance and Verify sections below are the
contract — no further product input needed to start.

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
- regression: click Register on an approved event while logged out → lands on
  `/login?...redirect=/member/events`, and after signing in the registration completes

## Notes
The comment at `src/pages/Events.jsx:281` ("approved and pending") suggests the current
behavior was known to someone, which is why the Decision section above gates this spec
rather than the Notes hedging it. Once the decision is recorded, the Acceptance and
Verify sections above are the contract.

Four callers each reimplement the date filter (`Home.jsx:187`, `Events.jsx:282`,
`member/Dashboard.jsx:327`, `member/Events.jsx:59`). Consolidating that is tempting
but out of scope here; leave it for a separate refactor.
