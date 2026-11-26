# Amenity photo lightbox as a native modal dialog
**Phase**: — · **Deps**: native-modal

## Goal
Resolve [#288](https://github.com/sqrDAO/danang-hub-app/issues/288): `AmenityPhotoLightbox` is a hand-rolled `role="dialog"` div that never moves or traps focus and locks scroll by mutating `body.style.overflow`. Render it as a native `<dialog>` opened with `showModal()`, following `Modal.jsx`, so focus, inert background, Escape and scroll lock come from the platform and the shared CSS.

## Files
- `src/components/AmenityPhotoLightbox.jsx` (edited) — native `<dialog>` lifecycle hook mirroring `Modal`, arrow keys on the dialog, no window listener or body style mutation
- `src/components/AmenityPhotoLightbox.css` (edited) — reset UA dialog box to a full-viewport overlay, dimming on `::backdrop`, reduced motion
- `src/components/Modal.css` (edited) — root scroll lock rule moved out
- `src/styles/globals.css` (edited) — `html:has(dialog:modal)` scroll lock, loaded on every page including `/`

## Acceptance
- [ ] Opening the lightbox renders a `dialog` that matches `:modal`
- [ ] Focus moves into the lightbox on open
- [ ] Tab never reaches an element behind the lightbox
- [ ] Escape closes the lightbox through `onClose`
- [ ] Closing returns focus to the photo button that opened it
- [ ] ArrowLeft and ArrowRight page photos while focus is inside the lightbox
- [ ] Clicking the dark area around the photo closes the lightbox
- [ ] Clicking the photo, nav buttons or thumbnails keeps the lightbox open
- [ ] Page content does not move sideways or scroll when the lightbox opens or closes
- [ ] The document cannot scroll while the lightbox is open
- [ ] A toast shown while the lightbox is open is hosted inside the lightbox and stays visible
- [ ] Shared `Modal` dialogs still lock document scroll
- [ ] NOT: `document.body.style.overflow` is written
- [ ] NOT: a `window` keydown listener is registered
- [ ] NOT: lightbox layout, colors or user-visible strings change
- [ ] NOT: the undefined `--spacing-xs` mobile nav offset is fixed here

## Verify
- `npm run lint` → exit 0, no warnings
- `npm test` → 0 failing tests
- `npm run build` → build succeeds
- `cd functions && npm run lint` → exit 0
- `VITE_FIREBASE_API_KEY=fixture-key VITE_FIREBASE_AUTH_DOMAIN=demo-danang.firebaseapp.com VITE_FIREBASE_PROJECT_ID=demo-danang VITE_FIREBASE_STORAGE_BUCKET=demo-danang.appspot.com VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 VITE_FIREBASE_APP_ID=fixture-app npm run dev:skipauth -- --host 127.0.0.1 --port 3288` → fixture app at `http://127.0.0.1:3288/`
- Manual (give a skipauth fixture amenity `photos`, do not commit): on `/` and `/member/bookings` at 1280px and 390px, light and dark, open a photo with Enter, Tab around, use arrows, Escape, reopen and click the dark area → every Acceptance item holds
- regression: open and Escape a shared `Modal` on `/member/bookings` → `html` overflow hidden while open, visible after

## Notes
- React removes the dialog before the layout-effect cleanup, so native focus return cannot run; the hook restores the opener like `Modal` does.
- The dialog fills the viewport, so `closedby="any"` light dismiss never fires; the dialog's own `click` with `target === currentTarget` is the backdrop click.
- Real iOS Safari behavior needs a device check.
