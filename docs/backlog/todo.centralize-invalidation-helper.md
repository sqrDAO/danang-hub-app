# Centralize query-invalidation helper
**Phase**: — · **Deps**: fix-event-delete-stale-upcoming, invalidate-memberstats-after-mutations

## Goal
Invalidation calls are copy-pasted: six identical `['bookings']` lines each in admin and member Bookings, and near-identical multi-key blocks across four mutations in member Events — `src/pages/admin/Events.jsx:238` already has the right shape as a file-local `invalidate(...keys)` helper. Promote it to a shared hook so future invalidation changes are one edit, not twelve.

## Files
- `src/hooks/useInvalidateQueries.js` (new) — `useInvalidateQueries()` returning `invalidate(...keys)`; each key may be a scalar or a full queryKey array — arrays pass through unchanged, scalars wrap as `[key]` — so composite keys like `['memberStats', uid]` stay intact
- `src/pages/admin/Events.jsx` (edited) — replace local helper with the hook
- `src/pages/admin/Bookings.jsx` (edited) — use the hook in all 6 call sites
- `src/pages/member/Bookings.jsx` (edited) — use the hook in all 6 call sites
- `src/pages/member/Events.jsx` (edited) — use the hook in all mutation `onSuccess` blocks
- `src/pages/admin/Amenities.jsx`, `src/pages/admin/Members.jsx`, `src/pages/member/Profile.jsx` (edited) — same

## Acceptance
- [ ] Behavior-preserving: each mutation invalidates the same key set as before (including keys added by the dep specs)
- [ ] The helper passes full queryKey arrays through unchanged (e.g. `invalidate(['memberStats', uid])` invalidates `{ queryKey: ['memberStats', uid] }`)
- [ ] No page calls `queryClient.invalidateQueries` directly except via the shared helper
- [ ] NOT: no query keys renamed or consolidated
- [ ] NOT: no invalidation sets changed

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → smoke: create/cancel booking (member), approve booking (admin), register/unregister event — lists refresh as before
- regression: `git grep -n "invalidateQueries(" src/pages` → zero hits (catches object AND legacy array forms; all page call sites go through the helper)

## Notes
Land after the two dep specs so their key additions ship independently and this stays a pure refactor. Waitlist mutations intentionally invalidate fewer keys than register — preserve that asymmetry.
