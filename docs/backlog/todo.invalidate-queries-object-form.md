# Fix invalidateQueries array-form calls for React Query v5
**Phase**: — · **Deps**: —

## Goal
33 call sites pass `invalidateQueries(['key'])`, but TanStack Query v5 only accepts the object filter form; an array has no `queryKey` property, so every call matches **all** cached queries and over-invalidates (refetches everything active). Convert each to `invalidateQueries({ queryKey: ['key'] })` so only the intended keys refetch.

## Files
- `src/pages/admin/Amenities.jsx` (edited) — 5 calls, `['amenities']`
- `src/pages/admin/Bookings.jsx` (edited) — 6 calls, `['bookings']`
- `src/pages/admin/Members.jsx` (edited) — 2 calls, `['members']`
- `src/pages/member/Bookings.jsx` (edited) — 6 calls, `['bookings']`
- `src/pages/member/Events.jsx` (edited) — 11 calls, `['myEvents']` / `['approvedEvents']` / `['upcomingEvents']`
- `src/pages/member/Profile.jsx` (edited) — 3 calls, `['members']` / `['memberStats', currentUser?.uid]`

## Acceptance
- [ ] Every `invalidateQueries` call in `src/**` passes `{ queryKey: [...] }`, preserving its existing key array verbatim
- [ ] `git grep "invalidateQueries(\[" -- 'src/**'` returns no matches
- [ ] Mutations still refresh their lists: approving a booking in admin Bookings updates the table without a manual reload
- [ ] NOT: no query keys renamed, added, or consolidated
- [ ] NOT: no other React Query options (`refetchOnWindowFocus`, `retry`) touched

## Verify
- `npm run lint` → passes with 0 warnings
- `npm run build` → succeeds
- `npm run dev` → edit profile on `/profile`, confirm member data refreshes; create then cancel a booking on member Bookings, confirm list updates
- regression: admin Events already uses the object form (`src/pages/admin/Events.jsx:239`) — leave as-is, confirm it still lints

## Notes
`src/pages/admin/Events.jsx` and parts of `src/pages/member/Events.jsx` already use the correct object form — only the 33 array-form sites change. Flagged by CodeRabbit on PR #16 (`src/pages/member/Profile.jsx`); pre-existing pattern, scoped here codebase-wide.
