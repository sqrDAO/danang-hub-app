# Local booking preview mode
**Phase**: — · **Deps**: —

## Goal
Provide a temporary Vite dev mode that opens the member booking page directly for local UI review. Keep the bypass limited to the dedicated local mode so normal development and production retain the existing auth and route guards.

## Files
- `package.json` (edited) — add the dedicated local booking dev command.
- `src/App.jsx` (edited) — redirect the local booking mode to the member booking page and bypass its auth guard only there.
- `src/pages/member/Bookings.jsx` (edited) — use a local amenity fallback and auto-open the preview modal.
- `src/components/BookingCalendar.jsx` (edited) — skip remote booking reads in the preview mode.
- `src/utils/localBookingMode.js` (new) — share the mode flag and fixture amenity.

## Acceptance
- [ ] `npm run dev:booking` opens `/member/bookings` from the root local URL.
- [ ] The booking route is accessible without Firebase authentication only in the dedicated Vite dev mode.
- [ ] The booking preview shows an amenity when local Firestore has no amenity documents.
- [ ] The root local preview opens the first amenity's booking modal automatically.
- [ ] Normal dev and production builds keep the existing protected member booking route.

## Verify
- `npm run lint` → passes.
- `npm run build` → passes.
- `npm run dev:booking` → root URL redirects to `/member/bookings`.
