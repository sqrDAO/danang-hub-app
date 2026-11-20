# Native shared modal
**Phase**: — · **Deps**: —

## Goal
Resolve [#195](https://github.com/sqrDAO/danang-hub-app/issues/195) with native modal focus, inert background and Escape dismissal. Preserve form unmounting and keep member selection and feedback usable above dialogs.

## Files
- `src/components/Modal.jsx` (edited) — lifecycle, native-close recovery and dismissal.
- `src/components/Modal.css` (edited) — backdrop, root scroll lock and reduced motion.
- `src/components/Toast.jsx` (edited) — interactive top-layer notifications in the active dialog.
- `src/components/Toast.css` (edited) — reset popover defaults and preserve toast positioning.
- `src/pages/admin/Bookings.jsx` (edited) — use an accessible member combobox.

- `src/components/MemberCombobox.jsx` (new) — keyboard selection and viewport-positioned popover.
- `src/components/MemberCombobox.css` (new) — component-owned picker presentation.
- `src/pages/admin/Bookings.css` (edited) — remove extracted picker rules.
- `src/locales/en.json` (edited) — empty-search feedback.
- `src/locales/vi.json` (edited) — translated empty-search feedback.
- `src/styles/globals.css` (edited) — load stable scrollbar gutter with global styles.

## Acceptance
- [ ] Keyboard focus stays in the topmost modal.
- [ ] Closing restores focus to the opener.
- [ ] Escape requests dismissal through onClose.
- [ ] Backdrop clicks request dismissal through onClose.
- [ ] Forms unmount on close.
- [ ] Stacked dialogs dismiss independently.
- [ ] A rejected close request leaves the controlled dialog visible after repeated Escape.
- [ ] Assign Booking member suggestions can be selected with pointer or arrow keys and Enter.
- [ ] Escape dismisses member suggestions before the enclosing modal.
- [ ] Suggestions follow scroll, resize and dialog animation completion without a continuous frame loop.
- [ ] Suggestions close when the input leaves the modal body.
- [ ] Empty searches show translated feedback.
- [ ] Escape with no suggestions reaches the modal.
- [ ] Closed suggestions leave no dangling aria-controls reference.
- [ ] Existing toasts do not replay their entry animation when the active dialog changes.
- [ ] Saving closes a modal and displays its success toast without crashing.
- [ ] Toast expiry during modal closure does not crash.
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
- `VITE_FIREBASE_API_KEY=fixture-key VITE_FIREBASE_AUTH_DOMAIN=demo-danang.firebaseapp.com VITE_FIREBASE_PROJECT_ID=demo-danang VITE_FIREBASE_STORAGE_BUCKET=demo-danang.appspot.com VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 VITE_FIREBASE_APP_ID=fixture-app npm run dev:skipauth -- --host 127.0.0.1 --port 3019` → fixture app, no production credentials.
- Manual: in Assign Booking, test arrows/Enter, empty searches in EN/VI, Escape, viewport resize and scrolling the input out of view.
- Manual: repeat amenity saves and close during toast expiry; no crash and feedback stays visible.
- Manual: stack event/registrants dialogs, display a toast, then Escape; toast does not animate again.
- Regression: native/fallback backdrops, mobile light/dark layout, scroll lock and reduced motion remain usable; inspect real iOS Safari separately.

## Notes
- Real iOS Safari behavior requires device verification; Chrome coverage is not a Safari claim.
- Root overflow lock is intentional for Safari; stable scrollbar gutter avoids desktop layout shift.
