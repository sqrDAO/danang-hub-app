# Remove dead, non-transactional approveEvent/rejectEvent from the service layer
**Phase**: — · **Deps**: —

## Goal
`approveEvent`/`rejectEvent` in the service layer are unused dead code that bypass every
guarantee the real `reviewEvent` callable provides (revision check, Event Hall
availability, linked-booking lifecycle, `everApproved` bookkeeping); `firestore.rules`
would silently allow these bare `updateDoc` writes if a future admin feature is wired to
them by mistake, since their names read as the "real" approve/reject functions.

## Files
- `src/services/events.js` (edited) — delete `approveEvent` (lines 312-319) and
  `rejectEvent` (lines 321-329).

## Acceptance
- [ ] `approveEvent` and `rejectEvent` no longer exist in `src/services/events.js`.
- [ ] No remaining references to either name anywhere in `src/`.
- [ ] NOT: this does not touch `reviewEvent`, `src/services/functions.js`'s callable
      wrapper, or any admin UI — `src/pages/admin/Events.jsx` already uses the callable
      exclusively.

## Verify
- `npm run lint && npm run build` → both clean (build failing on a stray reference would
  indicate a caller was missed).
- `grep -rn "approveEvent\|rejectEvent" src/` → zero matches (the `reviewEvent` callable
  and its wrapper in `src/services/functions.js` use that name, not `approveEvent`/
  `rejectEvent`, so no reference to either legacy name should remain anywhere).
- `npm test` → existing tests pass.
