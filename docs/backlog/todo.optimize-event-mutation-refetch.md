# Reduce full-collection refetches on event register/unregister/waitlist
**Phase**: — · **Deps**: centralize-invalidation-helper

## Goal
One register click refetches `['approvedEvents']` and `['upcomingEvents']` — both re-download the entire approved events set (`getUpcomingEvents` adds pending) — plus a useless `['myEvents']` refetch (`getMyEvents` filters `organizerId == uid`, unchanged by registering), ~4 collection reads to reflect a one-element attendees change. Patch the changed event in cache instead.

## Files
- `src/pages/member/Events.jsx` (edited) — in register/unregister/waitlist `onSuccess`, use `queryClient.setQueryData` to patch the affected event's `attendees`/`waitlist` array in the `['approvedEvents']` and `['upcomingEvents']` caches; drop the `['myEvents']` invalidation from register/unregister

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

## Notes
Low priority — pre-existing idiomatic invalidate-and-refetch, flagged for Firestore read cost (approved set downloaded twice per click; scales with event count). `setQueryData` must return new array/object references so React re-renders.
