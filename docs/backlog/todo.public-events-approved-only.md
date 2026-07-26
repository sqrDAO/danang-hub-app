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
- `src/pages/member/Dashboard.jsx` (edited) — **added to scope 2026-07-25.** It is a
  fourth `['upcomingEvents']` consumer the original spec missed; left alone it would
  have silently dropped pending events from the member dashboard. Same key and option
  as `member/Events.jsx`.

## Acceptance
- [ ] An anonymous visitor on `/` sees no `status: 'pending'` event.
- [ ] An anonymous visitor on `/events` sees no `status: 'pending'` event.
- [ ] A signed-in member on `/member/events` still sees pending events, including their own.
- [ ] The member Dashboard still shows the member's pending events.
- [ ] The member and public surfaces use different React Query keys.
- [ ] Existing `invalidate('upcomingEvents')` calls still refresh the member cache.
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
`member/Dashboard.jsx:327`, `member/Events.jsx:61`). Consolidating that is tempting
but out of scope here; leave it for a separate refactor.

The member key is `['upcomingEvents', 'withPending']` — deliberately a *prefix
extension* of the public `['upcomingEvents']`. React Query matches query keys by
prefix, so the twelve existing `invalidate('upcomingEvents')` call sites across
`member/Events.jsx` and `admin/Events.jsx` refresh both caches with no edit, while the
two caches stay separate entries. Verified: invalidating `['upcomingEvents']` marks
both stale; invalidating the member key alone leaves the public cache untouched.

Call sites use `queryFn: () => getUpcomingEvents(...)` rather than passing the function
reference. React Query hands the queryFn a context object, which would land in the new
options parameter — harmless today (no `includePending` property, so it defaults false)
but a trap the moment another option is added.
