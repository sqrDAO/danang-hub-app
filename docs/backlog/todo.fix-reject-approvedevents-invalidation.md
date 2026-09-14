# Invalidate approvedEvents cache when an admin rejects a previously-approved event
**Phase**: — · **Deps**: —

## Goal
Rejecting an already-approved event leaves the public `['approvedEvents']` React Query
cache stale, so the just-rejected event can keep appearing as approved and registerable
on the public Events page and Home until an unrelated refetch happens.

## Files
- `src/pages/admin/Events.jsx` (edited) — add `'approvedEvents'` to `rejectMutation`'s
  `onSuccess` invalidate call (line ~250), matching what `approveMutation` already does.

## Acceptance
- [ ] `rejectMutation.onSuccess` invalidates `'approvedEvents'` in addition to its current
      keys (`'events'`, `'pendingEvents'`, `'myEvents'`, `'upcomingEvents'`, `'bookings'`).
- [ ] Rejecting an approved event immediately removes it from the public `/events` page
      and Home's event list without a manual refresh, in the same browser session.
- [ ] NOT: this does not change what fields `reviewEvent` writes or add new invalidation
      to `approveMutation`, `promoteWaitlistMutation`, or any other mutation.

## Verify
- `npm run lint` → clean.
- `npm run build` → succeeds.
- Manual (dev server or emulators): approve a pending event so it appears on the public
  `/events` page, then reject it from `/admin/events` without reloading the public tab →
  on next focus/refetch of the public tab the event is gone; confirm via React Query
  devtools that `['approvedEvents']` was invalidated at the moment of rejection, not on a
  later unrelated refetch.
- regression: re-verify `approveMutation`'s existing invalidation still shows a newly
  approved event on the public page.
