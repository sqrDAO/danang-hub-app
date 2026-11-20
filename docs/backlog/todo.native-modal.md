# Native shared modal
**Phase**: — · **Deps**: —

## Goal
Resolve [#195](https://github.com/sqrDAO/danang-hub-app/issues/195) with native modal focus, inert background and Escape dismissal. Preserve form unmounting and keep member selection and feedback usable above dialogs.

## Files
- `src/components/Modal.jsx` (edited) — lifecycle, native-close recovery and dismissal.
- `src/components/Modal.css` (edited) — backdrop, root scroll lock and reduced motion.
- `src/components/Toast.jsx` (edited) — interactive top-layer notifications in the active dialog.
- `src/components/Toast.css` (edited) — reset popover defaults and preserve toast positioning.
- `src/pages/admin/Bookings.jsx` (edited) — portal member suggestions into their dialog.

## Acceptance
- [ ] Keyboard focus stays in the topmost modal.
- [ ] Closing restores focus to the opener.
- [ ] Escape requests dismissal through onClose.
- [ ] Backdrop clicks request dismissal through onClose.
- [ ] Forms unmount on close.
- [ ] Stacked dialogs dismiss independently.
- [ ] A rejected close request leaves the controlled dialog visible after repeated Escape.
- [ ] Assign Booking member suggestions can be selected.
- [ ] Toasts appear above the active dialog and can be dismissed without closing it.
- [ ] The underlying document cannot scroll while a modal is open.
- [ ] Mobile dialogs retain their bottom-sheet layout.
- [ ] Reduced motion disables modal entry animation.
- [ ] NOT: change caller submission or authorization behavior.

## Verify
- `npm run lint` → no errors or warnings.
- `npm run build` → production build succeeds.
- `npm test` → no failing tests.
- `cd functions && npm run lint` → no errors.
- `npm run dev:skipauth -- --port 3019` → local fixture application available.
- On `/admin/bookings`, open Assign Booking, search and select a member.
- On `/admin/events`, stack detail/registrants/profile dialogs; check Tab, Escape and opener focus.
- Trigger Copy emails in registrants; dismiss the visible toast without closing the dialog.
- Reproduce a native close with a refusing onClose; the dialog stays modal.
- Check backdrop fallback, mobile light/dark layout, scroll lock and reduced motion.

## Notes
- Real iOS Safari behavior requires device verification; Chrome coverage is not a Safari claim.
- Root overflow lock is intentional for Safari; stable scrollbar gutter avoids desktop layout shift.
