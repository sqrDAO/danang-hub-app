# Prevent double-submit on mutation buttons
**Phase**: — · **Deps**: —

## Goal
Disable write buttons while their mutation is in flight so double-clicks cannot fire the same request twice. UI-only; no service or rules changes.

## Files
- `src/pages/admin/Amenities.jsx` (edited) — create/save, toggle, delete
- `src/pages/admin/Events.jsx` (edited) — promote waitlist, delete
- `src/pages/admin/Bookings.jsx` (edited) — approve/reject/check-in/out/delete
- `src/pages/admin/Members.jsx` (edited) — save, delete
- `src/pages/member/Events.jsx` (edited) — register/unregister/waitlist/cancel request
- `src/pages/member/Bookings.jsx` (edited) — cancel, delete

## Acceptance
- [ ] Guarded buttons are disabled while their mutation is pending
- [ ] Confirms, toasts, and handlers are unchanged
- [ ] NOT: no Firestore/service/rules changes; no public-page navigation buttons

## Verify
- `npm run lint` → green
- `npm run build` → green
- Manual: double-click amenity create / booking approve / event register → one write
- regression: failed requests re-enable the button
