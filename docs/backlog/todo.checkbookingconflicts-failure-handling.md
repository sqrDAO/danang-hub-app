# Make checkBookingConflicts's failure handling match its callers' intent

**Phase**: — · **Deps**: —

## Decision required

`checkBookingConflicts` (`src/services/functions.js:6-21`) swallows every error internally
and always resolves `{hasConflicts: false, conflicts: []}` — CLAUDE.md's documented
"advisory, fails open" design. Its callers in `src/pages/member/Bookings.jsx`
(`handleContinueToConfirm:371-392`, `handleConfirmBooking:399-424`) each wrap the call in a
`try/catch` that shows `t('memberBookings.conflictCheckFailed')` on error — code that can
never run, since the service layer never rejects. Pick one:

- **A — Keep the advisory design, delete the dead code.** Remove the now-unreachable
  `catch` blocks and their `conflictCheckFailed` handling from both `Bookings.jsx`
  handlers (or replace with a comment noting the service fails open by design), and
  confirm/update the `conflictCheckFailed` i18n string's other call sites, if any.
- **B — Align with the `getAmenityBookingRanges` precedent and fail closed.** Make
  `checkBookingConflicts` rethrow instead of swallowing (mirroring
  `getAmenityBookingRanges`'s explicit contrast comment at
  `src/services/functions.js:28-31`), so a genuine service failure blocks the booking and
  surfaces `conflictCheckFailed` for real, rather than silently proceeding on
  `firestore.rules`, which does not enforce overlap.

This spec is written for **Option A** (matches the currently documented CLAUDE.md
architecture with the smallest change); swap in Option B's file list if the human wants the
stricter behavior instead.

## Goal

Remove the unreachable error-handling code in the booking-confirmation flow so the code's
visible behavior matches what actually happens on a `checkBookingConflicts` failure.

## Files

- `src/services/functions.js` (edited) — add a one-line comment above
  `checkBookingConflicts` noting that callers cannot observe a failure (it always
  resolves), so future readers don't repeat the dead-`catch` pattern.
- `src/pages/member/Bookings.jsx` (edited) — remove the `catch` blocks in
  `handleContinueToConfirm` and `handleConfirmBooking` that reference
  `conflictCheckFailed`, since `checkBookingConflicts` never rejects; keep the `finally`
  blocks that reset `isCheckingConflict`/submission state.
- `src/locales/en.json`, `src/locales/vi.json` (edited, if `conflictCheckFailed` has no
  other call site after this change) — remove the now-unused key from both files in the
  same change.

## Acceptance

- [ ] `handleContinueToConfirm` and `handleConfirmBooking` no longer contain a
      `catch` block whose only reachable trigger was `checkBookingConflicts` rejecting.
- [ ] `form.setIsCheckingConflict(false)` / `finishSubmitting()` still run after every
      `checkBookingConflicts` call, success or not.
- [ ] NOT: this does not change `checkBookingConflicts`'s return shape or add a new
      error path — Option A keeps the advisory design exactly as documented in CLAUDE.md.

## Verify

- `npm run lint` → passes.
- `npm run build` → passes.
- `node -e "..."` i18n parity check (see `CLAUDE.md` → Checks) → passes if
  `conflictCheckFailed` is removed from both locale files, or is unaffected if it's kept
  because another call site still uses it.
- Manual: in `firebase emulators:start`, stop the `checkBookingConflicts` function (or
  force it to throw) and confirm a booking attempt proceeds silently to submission with no
  error toast — the same behavior as today, now with no dead code implying otherwise.

## Notes

If the human picks Option B instead, the failure mode changes materially: a
`checkBookingConflicts` outage would now block every member from booking anything, not
just silently degrade to advisory-only. That's a real availability trade-off against the
Cloud Function's own uptime and belongs in the Decision discussion, not assumed here.
