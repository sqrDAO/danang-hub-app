# Add double-submit guard to handleCancelPlan
**Phase**: — · **Deps**: —

## Goal
Every other mutation action handler touched by this week's double-submit-guard rollout
(`handleCancel` and the admin approve/reject/delete/promote handlers) now guards with
`if (isPendingFor(mutation, id)) return`, but `handleCancelPlan` in
`src/pages/member/Bookings.jsx` doesn't. It's currently inert (the triggering button is
already `disabled={cancelPending}`), but align it so the pattern is complete and doesn't
silently rely on the button's disabled state alone.

## Files
- `src/pages/member/Bookings.jsx` (edited) — `handleCancelPlan` (line 524): add
  `if (isPendingFor(mutations.cancelPlanMutation, planGroupId)) return` as its first
  line, matching the guard style used by `handleCancel` (line 501) and `handleDelete`
  (line 508) in the same file. `isPendingFor` is already imported (line 15).

## Acceptance
- [ ] `handleCancelPlan` returns immediately if a cancel mutation for the same `planGroupId` is already in flight.
- [ ] NOT: no change to the button's existing `disabled={cancelPending}` prop — this is a defense-in-depth addition, not a replacement.
- [ ] NOT: no change to any other handler in this file.

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → `/member/bookings`, cancel a fixed-desk plan → single cancellation, no
  double-submit possible even if the disabled state is bypassed (e.g. via devtools)
- regression: single-booking cancel (`handleCancel`) still works unchanged

## Notes
Found during the 2026-07-27 weekly review. Low priority — not exploitable today because
the button is already disabled while pending — bundle with any other touch of this file
rather than shipping alone.
