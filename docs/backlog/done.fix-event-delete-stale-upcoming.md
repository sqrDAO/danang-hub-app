# Fix stale Upcoming Events after deleting a pending event request
**Phase**: — · **Deps**: —

## Goal
`deleteMutation` in member Events invalidates only `['myEvents']`, but the deleted pending event also renders in the Upcoming Events list (`getUpcomingEvents` fetches approved AND pending), so it visibly persists on the same screen after deletion. Add the missing key invalidations so the whole page reconciles.

## Files
- `src/pages/member/Events.jsx` (edited) — `deleteMutation.onSuccess` (~line 244): also invalidate `['upcomingEvents']` and `['pendingEvents']`

## Acceptance
- [ ] Deleting a pending event request removes it from the Upcoming Events list without a reload or tab refocus
- [ ] `deleteMutation.onSuccess` invalidates `['myEvents']`, `['upcomingEvents']`, and `['pendingEvents']`
- [ ] NOT: no other mutation's invalidation set changed in this spec
- [ ] NOT: no query keys renamed or consolidated

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → create an event request, then delete it while still pending; confirm it disappears from both "My Event Requests" and "Upcoming Events" immediately
- regression: create + register/unregister flows on `/member/events` still refresh their lists

## Notes
Pre-PR-#20, the v4 array form accidentally invalidated the entire cache, masking this gap; `src/main.jsx` sets `staleTime: 30s` and `refetchOnWindowFocus: false`, so a missed key is user-visible. `['pendingEvents']` covers the admin approval queue in a shared-cache session.
