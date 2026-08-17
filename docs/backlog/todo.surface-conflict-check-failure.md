# Warn the member when the booking conflict check itself fails
**Phase**: — · **Deps**: —

## Goal
`checkBookingConflicts` always resolves `{hasConflicts: false}` on failure (advisory-by-design,
per CLAUDE.md), so `handleContinueToConfirm`'s catch branch that shows `conflictCheckFailed` can
never run. A real backend outage during the check is invisible: the member silently proceeds to
the confirm step as if nothing is wrong. Surface the failure without changing the documented
fail-open behavior for booking creation itself.

## Files
- `src/services/functions.js` (edited) — have `checkBookingConflicts`'s catch branch resolve
  `{hasConflicts: false, conflicts: [], checkFailed: true}` instead of omitting the new field.
- `src/pages/member/Bookings.jsx` (edited) — in `handleContinueToConfirm` (~line 375), branch on
  `conflictCheck.checkFailed` to show `t('memberBookings.conflictCheckFailed')` and stay on step
  1, instead of relying on the never-thrown catch branch; keep the catch branch as a defensive
  fallback for genuinely unexpected errors (e.g. a thrown error from `t()` itself).

## Acceptance
- [ ] When `checkBookingConflicts`'s underlying callable throws, `handleContinueToConfirm` shows
      `memberBookings.conflictCheckFailed` and does not advance to booking step 2.
- [ ] When the callable succeeds with `hasConflicts: false`, the member advances to step 2
      exactly as before (no behavior change on the success path).
- [ ] When the callable succeeds with `hasConflicts: true`, `memberBookings.conflictError` is
      shown exactly as before.
- [ ] `checkBookingConflictsStrict` (used by admin assignment) is unchanged.
- [ ] NOT: booking creation itself does not become blocked or fail-closed — this only changes
      what the member sees before reaching the confirm step.

## Verify
- `npm run lint` → passes.
- `npm run build` → passes.
- `npm test` → passes (add a case if `test/` has coverage for this service function; otherwise
  this is a component-level change, verify manually).
- `firebase emulators:start`, temporarily stop/break the `checkBookingConflicts` callable (or
  simulate by throwing in a local override) → confirm the member sees the conflict-check-failed
  message and cannot proceed past step 1.
- regression: normal booking flow (no conflicts, real conflicts) still works as before.
