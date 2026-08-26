# Local skip-auth preview mode
**Phase**: — · **Deps**: —

## Goal
Give a dedicated Vite dev command that signs in a stub admin and serves an
in-memory amenities, bookings, and events dataset so a slot can be booked and
an event registered without Firebase login. Keep `npm run dev` and production
on the real auth guards and Firestore.

## Files
- `package.json` (edited) — `dev:skipauth` runs Vite with mode `skipauth`.
- `.env.skipauth` (new) — `VITE_SKIP_AUTH=true`.
- `src/utils/localDevMode.js` (new) — DEV + skip-auth flag and stub user.
- `src/contexts/LocalDevAuthProvider.jsx` (new) — AuthContext with no Firebase listener.
- `src/services/localDevFixtures.js` (new) — seed amenities, bookings, events, members, projects.
- `src/services/localDevStore.js` (new) — in-memory CRUD used only in skip-auth.
- `src/services/{amenities,bookings,events,functions,members,projects}.js` (edited) — local-store early returns, including completed-count aggregates.
- `src/App.jsx` (edited) — stub provider only when skip-auth is on.
- `README.md` (edited) — document `npm run dev:skipauth`; warn that `.env.local` loads in every mode.
- `test/localDevMode.test.js` (new) — DEV/flag matrix.
- `test/localDevStore.test.js` (new) — booking filter and desk-capacity overlap.

## Acceptance
- [x] `npm run dev:skipauth` boots with a signed-in stub admin (profile complete).
- [x] `/member/bookings` lists fixture amenities and opens the booking calendar.
- [x] Booking a free Meeting Room slot writes to the in-memory store and greys out on the next calendar load.
- [x] `/member/events` lists the fixture event; register stays in memory.
- [x] `npm run dev` and `npm run build` still require a real Firebase session and do not use the store.
- [x] A production `npm run build` does not contain `local-dev-user`, fixture amenity names, or `__DANANG_LOCAL_DEV_STORE__`.
- [x] `/admin/dashboard` completed-booking and completed-event cards do not call Firestore.
- [x] A skip-auth booking without an explicit status is `pending`.
- [x] NOT: skip-auth in a production build, writing fixture data to production Firestore, or auto-opening the booking modal.
- [x] NOT: event create, waitlist, Storage upload, or notifications.

## Verify
- `npm run lint` → exits successfully with zero warnings.
- `npm run build` → production build completes successfully (skip-auth off); dist has no `local-dev-user`.
- `npm test` → local-dev tests pass, including desk conflict at capacity 8.
- `npm run dev:skipauth` → `/member/bookings` shows Coworking Space, Meeting Room, and Event Hall.
- `npm run dev:skipauth` → book a Meeting Room slot → reload calendar → that slot is grey.
- `npm run dev:skipauth` → `/member/events` shows one Event; Register succeeds without Firebase.
- regression: `npm run dev` → unauthenticated `/member` still redirects to `/login`.

## Notes
Stub `membershipType` is `admin` so the header view-switch reaches both portals. Logout is a no-op. Data resets on a full reload. Fixtures are three amenities and one event — no extra copy. Grey-out is Meeting Room (single occupancy); the desk stays capacity 8.
