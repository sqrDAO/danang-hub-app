# Centralize query-invalidation helper
**Phase**: — · **Deps**: fix-event-delete-stale-upcoming, invalidate-memberstats-after-mutations

## Goal
Invalidation calls are copy-pasted: six identical `['bookings']` lines each in admin and member Bookings, and near-identical multi-key blocks across four mutations in member Events — `src/pages/admin/Events.jsx:238` already has the right shape as a file-local `invalidate(...keys)` helper. Promote it to a shared hook so future invalidation changes are one edit, not twelve.

## Files
- `src/hooks/useInvalidateQueries.js` (new) — `useInvalidateQueries()` returning `invalidate(...keys)` wrapping `queryClient.invalidateQueries({ queryKey: [key] })` per key
- `src/pages/admin/Events.jsx` (edited) — replace local helper with the hook
- `src/pages/admin/Bookings.jsx` (edited) — use the hook in all 6 call sites
- `src/pages/member/Bookings.jsx` (edited) — use the hook in all 6 call sites
- `src/pages/member/Events.jsx` (edited) — use the hook in all mutation `onSuccess` blocks
- `src/pages/admin/Amenities.jsx`, `src/pages/admin/Members.jsx`, `src/pages/member/Profile.jsx` (edited) — same

## Acceptance
- [ ] Behavior-preserving: each mutation invalidates exactly the same key set as before (including keys added by the dep specs)
- [ ] No page calls `queryClient.invalidateQueries` directly except via the shared helper
- [ ] NOT: no query keys renamed or consolidated; no invalidation sets changed

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → smoke: create/cancel booking (member), approve booking (admin), register/unregister event — lists refresh as before
- regression: `git grep -n "invalidateQueries({" src/pages` → only the helper module remains (or zero hits in pages)

## Notes
Land after the two dep specs so their key additions ship independently and this stays a pure refactor. Waitlist mutations intentionally invalidate fewer keys than register — preserve that asymmetry.
