# Reduce full-collection refetches on event register/unregister/waitlist
**Phase**: — · **Deps**: centralize-invalidation-helper

## Goal
One register click refetches `['approvedEvents']` and `['upcomingEvents']` — both re-download the entire approved events set (`getUpcomingEvents` adds pending) — plus a useless `['myEvents']` refetch (`getMyEvents` filters `organizerId == uid`, unchanged by registering), ~4 collection reads to reflect a one-element attendees change. Patch the changed event in cache instead.

## Files
- `src/pages/member/Events.jsx` (edited) — in register/unregister/waitlist `onSuccess` (lines ~275, ~290, ~303, ~316), use `queryClient.setQueryData` to patch the affected event's `attendees`/`waitlist` array in the `['approvedEvents']` and `['upcomingEvents']` caches; drop the `['myEvents']` invalidation from register/unregister

## Acceptance
- [ ] Registering/unregistering updates the event card (attendee count, button state) without refetching the events collections
- [ ] Waitlist join/leave updates the card the same way
- [ ] `['memberStats']` invalidation from `todo.invalidate-memberstats-after-mutations` is preserved
- [ ] NOT: no service-layer (`src/services/events.js`) query changes
- [ ] NOT: no change to admin Events mutations

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → register for an event; devtools network shows no events collection reads; count updates; unregister likewise
- regression: deep-link `?action=register` flow still completes; tab refocus still refetches upcoming events (its per-query `refetchOnWindowFocus: true` untouched)

### Verified 2026-07-26 (`npm run dev` against Firestore/Auth/Functions emulators)
Measured the Firestore gRPC channels in the browser network log, with the pre-change
code hot-reloaded back in as a control:

| one register click | before | after |
|---|---|---|
| `Firestore/Write` requests | 1 | 1 |
| `Firestore/Listen` (read) requests | **3** | **0** |

Three reads before matches the three invalidated keys that actually refetch
(`approvedEvents`, `upcomingEvents`, `myEvents`). Card state updates identically either
way: `0 / 10 attendees` → `1 / 10` and the button flips to "Registered - Click to
Unregister". Unregister behaves the same — count returns to `0 / 10`, Write traffic only.

Note: registration is **denied on `main`** (`PERMISSION_DENIED` at `firestore.rules:95`),
so this had to be run with `todo.event-rules-attendee-writes`' ruleset loaded into the
emulator. That is a live reproduction of the bug that spec fixes, on a real signed-in
account.

## Notes
Low priority — pre-existing idiomatic invalidate-and-refetch, flagged for Firestore read cost (approved set downloaded twice per click; scales with event count). `setQueryData` must return new array/object references so React re-renders.

There is no `queryClient` in `member/Events.jsx` any more: PR #29 (`3a1df7a`) replaced it with the `useInvalidateQueries()` hook, so `useEventMutations` holds only `invalidate(...)`. Add `useQueryClient()` back alongside the hook rather than reaching through it — the hook deliberately exposes invalidation only. Note the waitlist mutations already skip `myEvents`; only register/unregister carry the useless one.

Those same `onSuccess` bodies now also call `promptPushOptInAfterSuccess` (PR #32) — leave it in place and in order.
