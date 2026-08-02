# Fix register/waitlist cache patch targeting the wrong query key
**Phase**: — · **Deps**: —

## Goal
`patchEventInCaches` in `src/pages/member/Events.jsx` patches the query cache key
`['upcomingEvents']` on register/unregister/waitlist join/leave, but the page's own
"Upcoming Events" list (and `src/pages/member/Dashboard.jsx`) actually subscribes to
`['upcomingEvents', 'withPending']` — a different key that `setQueryData`'s exact-match
lookup never touches. Registering for an event leaves the button/count stale on both
pages until a window refocus or remount. Patch the key the query actually uses.

## Files
- `src/pages/member/Events.jsx` (edited) — `EVENT_LIST_KEYS` (~line 260): change
  `'upcomingEvents'` to the tuple `['upcomingEvents', 'withPending']` (i.e. patch
  `queryClient.setQueryData(['upcomingEvents', 'withPending'], ...)` alongside
  `['approvedEvents']` in `patchEventInCaches`, ~line 273-286).
- `src/pages/member/Events.jsx` (edited) — the comment at ~line 188-190 claiming a
  "prefix match" covers this: correct it to state that `setQueryData` needs the literal
  key, unlike `invalidateQueries`.

## Acceptance
- [ ] Registering for an event updates the attendee count and button state on the same
      page's "Upcoming Events" section without a window refocus or remount.
- [ ] Unregistering does the same.
- [ ] Joining the waitlist updates the waitlist count/position on the same page's
      "Upcoming Events" section without a window refocus or remount.
- [ ] Leaving the waitlist does the same.
- [ ] `src/pages/member/Dashboard.jsx`'s upcoming-events list reflects the same
      register/unregister without a window refocus or remount (shared query key).
- [ ] NOT: no change to the `['approvedEvents']` patch path, which already works correctly.
- [ ] NOT: no change to `invalidate(...)` calls in `createMutation`/`deleteMutation` (they use `invalidateQueries`, whose prefix match already covers `['upcomingEvents', 'withPending']` correctly).

## Verify
- `npm run dev` → open `/member/events`, register for an approved event → attendee
  count and button update immediately in the "Upcoming Events" section, no refocus needed
- same session → open `/member` (Dashboard) in a second tab, register in the first tab,
  switch to the second tab → count reflects the change (React Query cache is shared
  per browser session, so this should update on next render/refetch trigger, not require
  a hard reload)
- unregister and waitlist join/leave: repeat the same check for each
- `npm run lint && npm run build` → green
- regression: `['approvedEvents']`-only surfaces (e.g. registration eligibility checks)
  still update correctly — this spec must not touch that key's patch path

## Notes
Found during the 2026-07-27 weekly review while verifying PR #50
(`todo.optimize-event-mutation-refetch.md`). That spec's own emulator measurement (3
Firestore reads → 0) is real and unaffected by this bug — the write path and the
`['approvedEvents']` patch both work; only the second list's key is wrong. `setQueryData`
does an exact key match (hashes the full key array), unlike `invalidateQueries`'s
default `exact: false` prefix match — that's the whole bug, not a deeper caching issue.
