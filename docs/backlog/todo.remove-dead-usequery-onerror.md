# Remove dead v4 onError option from UnifiedCalendar useQuery
**Phase**: — · **Deps**: —

## Goal
`src/components/UnifiedCalendar.jsx:100` passes `onError` to `useQuery`, but React Query v5 removed query-level `onSuccess`/`onError`/`onSettled` — the callback is silently ignored dead code, missed by PR #20 which only touched `src/pages`. Remove it; the component already handles errors via the destructured `bookingsError`.

## Files
- `src/components/UnifiedCalendar.jsx` (edited) — drop the `onError` option from the bookings `useQuery` (~lines 87–103)

## Acceptance
- [ ] No `useQuery` call in `src/**` passes `onError`, `onSuccess`, or `onSettled`
- [ ] Calendar error banner still renders when `getBookings` rejects
- [ ] NOT: `useMutation` callbacks untouched (v5 still supports them)

## Verify
- `npm run lint && npm run build` → green
- `git grep -n -e onError -e onSuccess -e onSettled -- src/` → for each hit, open the file and confirm the enclosing call is `useMutation` (v5 still supports these there); grep is line-based, so judge by the enclosing call, never by the hit line alone
- regression: `/member/bookings` calendar renders bookings and events normally

## Notes
Sweep confirmed this is the only v4-style query-callback site in `src/`; every other `onError`/`onSuccess` belongs to `useMutation`.
