# Invalidate memberStats after booking and event-registration mutations
**Phase**: — · **Deps**: —

## Goal
`['memberStats', uid]` derives `totalBookings`/`eventsAttended` from bookings and event attendees (`src/services/members.js:63-85`), but no booking or register/unregister mutation invalidates it, so Profile and the admin member-stats modal show stale counts for up to 30s after a mutation. Add `{ queryKey: ['memberStats'] }` invalidation (prefix match covers all uids) to those mutations.

## Files
- `src/pages/member/Bookings.jsx` (edited) — create/recurring/update/delete/fixed-desk/cancel-plan mutations (~lines 266–330)
- `src/pages/admin/Bookings.jsx` (edited) — update/delete/check-in/check-out mutations (~lines 139–163), `handleAssigned`, bulk approve
- `src/pages/member/Events.jsx` (edited) — register/unregister mutations (~lines 265, 281)

## Acceptance
- [ ] Every booking mutation listed in Files also invalidates `{ queryKey: ['memberStats'] }`
- [ ] Register and unregister mutations also invalidate `{ queryKey: ['memberStats'] }`
- [ ] Cancelling a booking then opening `/profile` within 30s shows the decremented `totalBookings`
- [ ] NOT: no changes to waitlist mutations (they don't affect attendees counts)
- [ ] NOT: no query keys renamed; no `staleTime`/refetch options touched

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → visit `/profile` (loads stats), create a booking, return to `/profile` within 30s → `totalBookings` incremented
- regression: admin Bookings check-in/check-out still refresh the bookings table

## Notes
Pre-PR-#20 the array form invalidated the whole cache, masking these gaps. If `todo.centralize-invalidation-helper` lands first, apply this through the shared helper instead of 12 hand edits.
