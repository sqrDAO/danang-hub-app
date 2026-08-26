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
- `firestore.indexes.json` (edited) — `events (status ASC, date ASC)` for the events aggregate,
  plus `bookings (status ASC, endTime ASC)` for `autoCheckoutExpiredBookings`

## Acceptance
- [x] `src/pages/admin/Dashboard.jsx` fetches bookings under `['bookings', 'admin-dashboard']`
- [x] `src/pages/admin/Bookings.jsx` fetches bookings under `['bookings', 'admin-list']`
- [x] `src/pages/admin/Dashboard.jsx` fetches events under `['events', 'admin-dashboard']`
- [x] `src/pages/admin/Events.jsx` fetches events under `['events', 'admin-list']`
- [x] `src/pages/member/Dashboard.jsx` fetches bookings under `['bookings', uid, 'dashboard']`
- [x] `src/pages/member/Bookings.jsx` fetches bookings under `['bookings', uid, 'list']`
- [x] `getCompletedBookingsCount` uses `getCountFromServer` over `status == 'completed'`
- [x] `getCompletedEventsCount` uses `getCountFromServer` over `status == 'approved'` and past `date`
- [x] Neither completed stat is derived from the dashboard's windowed `bookings`/`events` arrays
- [x] Count queries are keyed `['bookings'|'events', 'count', 'completed']` so `invalidate('bookings'|'events')` prefix-matches them
- [x] A failed or in-flight count renders `—`, never `0`
- [x] `npm run lint` passes without adding an `eslint-disable`
- [x] NOT: change the `-90`/`+180` dashboard window or the `-365`/`+365` list windows
- [x] NOT: qualify the completed card labels with a time window (they are true totals)
- [x] NOT: change `activeBookings`, `upcomingBookings`, or `availableAmenities`
- [x] NOT: introduce a `completed` status for events (none exists in the model)
- [x] `firestore.indexes.json` gains `events (status ASC, date ASC)`
- [x] `firestore.indexes.json` gains `bookings (status ASC, endTime ASC)`

## Verify
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass
- `grep -rn "queryKey: \['bookings'\]\|queryKey: \['events'\]" src/` → no matches
- `npm run dev`, admin → /admin/bookings, then /admin/dashboard within 30s; note "Completed".
  Hard-reload /admin/dashboard → same number.
- `npm run dev`, admin → /admin/bookings filtered to status `completed` with past bookings shown
  → its total matches the Dashboard "Completed Bookings" card exactly, with no date restriction.
- `firebase deploy --only firestore:indexes` → succeeds (CI never deploys indexes; this is manual)
- after the index builds, /admin/dashboard "Completed Events" shows a number, not `—`
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
- Composite index direction is load-bearing: an equality + range query needs the ASCENDING
  variant of the range field, and a DESCENDING twin does not serve it. This bit three queries
  here — both `bookings (status, endTime)` and `(status, startTime)` for the sweep, and
  `events (status, date)` for this aggregate. The emulator does not enforce composite indexes
  and will pass either way — this can only be checked against the real project.
- The `bookings status == 'completed'` aggregate needs no composite index (single equality) and
  was verified working against the real project: 162.
- `bookings (status, endTime)` is unrelated to this dashboard change but ships here so the repo
  matches production: it was deployed on 2026-08-26 to unbreak `autoCheckoutExpiredBookings`,
  and an index live in prod but absent from this file is exactly the drift a later
  `firestore:indexes` deploy offers to delete. The function fix itself is a separate spec.
- `autoCheckoutExpiredBookings` (hourly) owns the flip to `status: 'completed'`, so the count
  can lag an expired booking by up to an hour. Intended: the card tracks recorded state.
- Fixed desk plans are one booking doc per working day, so a single plan adds ~65 to this
  count. Expected, not a bug — don't dedupe by `planGroupId`.
