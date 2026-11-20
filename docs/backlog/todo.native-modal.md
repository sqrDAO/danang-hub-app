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
- `src/pages/admin/Bookings.css` (edited) — reset popover placement and highlight active options.
- `src/styles/globals.css` (edited) — load stable scrollbar gutter with global styles.

- `scripts/verifyNativeModal.cjs` (new) — actual fixture-page save, picker and toast lifecycle regressions.

- `docs/review/native-modal-picker.png` (new) — mobile fixture screenshot for PR review.

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
- [ ] Suggestions remain aligned and visible after scroll and resize.
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
- `npm install --prefix /tmp/modal195-browser --no-save playwright@1.65.1` → isolated browser-test tooling installed (requires local Chrome).
- `VITE_FIREBASE_API_KEY=fixture-key VITE_FIREBASE_AUTH_DOMAIN=demo-danang.firebaseapp.com VITE_FIREBASE_PROJECT_ID=demo-danang VITE_FIREBASE_STORAGE_BUCKET=demo-danang.appspot.com VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 VITE_FIREBASE_APP_ID=fixture-app npm run dev:skipauth -- --host 127.0.0.1 --port 3019` → fixture app, no production credentials.
- `NODE_PATH=/tmp/modal195-browser/node_modules node scripts/verifyNativeModal.cjs` → repeated amenity saves, toast expiry during close, desktop/mobile picker alignment after scroll/resize, pointer/keyboard selection, stacked toasts and focus recovery pass without page errors.
- Regression: native/fallback backdrops, mobile light/dark layout, scroll lock and reduced motion remain usable; inspect real iOS Safari separately.

## Notes
- Real iOS Safari behavior requires device verification; Chrome coverage is not a Safari claim.
- Root overflow lock is intentional for Safari; stable scrollbar gutter avoids desktop layout shift.
