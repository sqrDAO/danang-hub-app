# Fix stale pending UI after desk auto-approve
**Phase**: — · **Deps**: —

## Goal
After a member creates an ad-hoc desk booking, auto-approve flips `pending` → `approved` server-side. The list currently refetches too early and keeps cancel/delete buttons as if still pending. Resync the booking after create so the UI shows the final status.

## Files
- `src/services/bookings.js` (edited) — poll helper that waits while a booking stays `pending` (short timeout)
- `src/pages/member/Bookings.jsx` (edited) — after desk create/recurring create success, re-invalidate bookings once auto-approve (or timeout) settles

## Acceptance
- [ ] Creating a capacity-available desk booking (non fixed-desk) shows status `approved` in upcoming bookings without a full page reload
- [ ] That approved booking does not show cancel/delete buttons
- [ ] Creating a desk booking that stays pending (capacity full) still shows cancel/delete after create
- [ ] Meeting-room / podcast / fixed-desk create behavior unchanged (still pending when applicable)
- [ ] NOT: no change to Cloud Functions auto-approve rules or firestore.rules

## Verify
- `npm run lint` → green
- `npm run build` → green
- Manual: book a free desk → modal closes → upcoming card shows `approved`, no action buttons
- Manual: book a full desk (or non-desk) → still `pending` with cancel/delete
- regression: cancel/delete still work for true pending bookings
