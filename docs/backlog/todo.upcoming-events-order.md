# Upcoming events list nearest first
**Phase**: — · **Deps**: —

## Goal
Every "Upcoming Events" list showed the farthest event first, because `getUpcomingEvents` sorted by date descending and the admin dashboard took the first 5 of a `getEvents` result ordered `date desc`. Sort upcoming lists ascending by start date so the next event leads; past-event lists keep newest first.

## Files
- `src/utils/eventOrder.js` (new) — `sortEventsNearestFirst`, pure ascending sort by `date`, undated/invalid last
- `src/services/events.js` (edited) — `getUpcomingEvents` returns nearest first
- `src/services/localDevStore.js` (edited) — local `listLocalUpcomingEvents` nearest first; `listLocalApprovedEvents` keeps its own newest-first sort
- `src/pages/admin/Dashboard.jsx` (edited) — upcoming list sorted nearest first before `.slice(0, 5)`
- `test/eventOrder.test.js` (new) — behavior test with hard-coded dates

## Acceptance
- [ ] Home "Upcoming Events" lists the nearest event first
- [ ] Member dashboard "Upcoming Events" shows the 5 nearest events, nearest first
- [ ] Member Events page "Upcoming Events" lists the nearest event first
- [ ] Admin dashboard "Upcoming Events" shows the 5 nearest events, nearest first
- [ ] NOT: past-event lists (`getApprovedEvents`, `getPendingEvents`, `getMyEvents`, `getEvents`) change order

## Verify
- `npm test` → `test/eventOrder.test.js` passes
- `npm run lint && npm run build` → green
- `npm run dev` (local dev mode) → Home, `/member/dashboard`, `/member/events`, `/admin` upcoming lists read nearest first
- regression: Home and `/member/events` past-events sections still newest first

## Notes
Member Dashboard slices the first 5 of `getUpcomingEvents`, so it showed the 5 farthest events before this fix, not just the wrong order.
