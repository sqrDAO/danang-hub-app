# Fix admin Dashboard completed booking/event counts
**Phase**: — · **Deps**: —

## Goal
The admin Dashboard's "Completed Bookings" card reports a different number depending on which
page was visited first, and counts elapsed time instead of status. Make the counts
deterministic, status-driven, and true all-time totals rather than window-bounded.

## Files
- `src/services/bookings.js` (edited) — `getCompletedBookingsCount` server-side aggregate
- `src/services/events.js` (edited) — `getCompletedEventsCount` server-side aggregate
- `src/pages/admin/Dashboard.jsx` (edited) — scoped query keys; `useAdminDashboardData` hook; aggregate-backed completed cards
- `src/pages/admin/Bookings.jsx` (edited) — scope its `['bookings']` key
- `src/pages/admin/Events.jsx` (edited) — scope its `['events']` key
- `src/pages/member/Dashboard.jsx` (edited) — scope its `['bookings', uid]` key
- `src/pages/member/Bookings.jsx` (edited) — scope its `['bookings', uid]` key

## Acceptance
- [ ] `src/pages/admin/Dashboard.jsx` fetches bookings under `['bookings', 'admin-dashboard']`
- [ ] `src/pages/admin/Bookings.jsx` fetches bookings under `['bookings', 'admin-list']`
- [ ] `src/pages/admin/Dashboard.jsx` fetches events under `['events', 'admin-dashboard']`
- [ ] `src/pages/admin/Events.jsx` fetches events under `['events', 'admin-list']`
- [ ] `src/pages/member/Dashboard.jsx` fetches bookings under `['bookings', uid, 'dashboard']`
- [ ] `src/pages/member/Bookings.jsx` fetches bookings under `['bookings', uid, 'list']`
- [ ] `getCompletedBookingsCount` uses `getCountFromServer` over `status == 'completed'`
- [ ] `getCompletedEventsCount` uses `getCountFromServer` over `status == 'approved'` and past `date`
- [ ] Neither completed stat is derived from the dashboard's windowed `bookings`/`events` arrays
- [ ] Count queries are keyed `['bookings'|'events', 'count', 'completed']` so `invalidate('bookings'|'events')` prefix-matches them
- [ ] A failed or in-flight count renders `—`, never `0`
- [ ] `npm run lint` passes without adding an `eslint-disable`
- [ ] NOT: change the `-90`/`+180` dashboard window or the `-365`/`+365` list windows
- [ ] NOT: qualify the completed card labels with a time window (they are true totals)
- [ ] NOT: change `activeBookings`, `upcomingBookings`, or `availableAmenities`
- [ ] NOT: introduce a `completed` status for events (none exists in the model)
- [ ] NOT: add a new Firestore composite index (the existing `events (status, date)` should cover it)

## Verify
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass
- `grep -rn "queryKey: \['bookings'\]\|queryKey: \['events'\]" src/` → no matches
- `npm run dev`, admin → /admin/bookings, then /admin/dashboard within 30s; note "Completed".
  Hard-reload /admin/dashboard → same number.
- `npm run dev`, admin → /admin/bookings filtered to status `completed` with past bookings shown
  → its total matches the Dashboard "Completed Bookings" card exactly, with no date restriction.
- Browser devtools console on /admin/dashboard → no `failed-precondition` index error from
  either aggregate.
- regression: approve a booking in /admin/bookings → the Dashboard "Completed" cards and lists
  both refresh; /member/dashboard and /member/bookings still list bookings.

## Notes
- Root cause of the flapping number: React Query keys on `queryKey` alone: two pages shared
  `['bookings']` while passing different date windows to `getBookings`, so `staleTime: 30s`
  served one page's window to the other.
- Keep `'bookings'`/`'events'` as the first key segment — `useInvalidateQueries('bookings')`
  relies on React Query v5 prefix matching, so every scoped key stays invalidated.
- Aggregates are authorized against the query, not its results. `bookings` has
  `allow read: if isAdmin()`, so the unfiltered count is admin-only; `events` is world-readable.
- The Firestore emulator does not enforce composite indexes, so it CANNOT confirm the events
  aggregate's index coverage — that check has to happen against the real project. If it throws
  `failed-precondition`, add the index from the console link to `firestore.indexes.json` and
  deploy it with `firebase deploy --only firestore:indexes` (CI never deploys indexes).
- `autoCheckoutExpiredBookings` (hourly) owns the flip to `status: 'completed'`, so the count
  can lag an expired booking by up to an hour. Intended: the card tracks recorded state.
- Fixed desk plans are one booking doc per working day, so a single plan adds ~65 to this
  count. Expected, not a bug — don't dedupe by `planGroupId`.
