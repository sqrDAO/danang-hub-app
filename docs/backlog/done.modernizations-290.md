# Small modernizations: dvh, matchMedia, toSorted, Error cause
**Phase**: — · **Deps**: —

## Goal
Replace hand-rolled workarounds flagged in #290 with platform built-ins: `dvh` full-height screens, a `matchMedia` breakpoint hook, `toSorted`, and `Error` `cause`. No user-visible behavior changes; `Object.groupBy` is skipped (see Notes).

## Files
- `src/components/Layout.css` (edited) — `.layout` adds `min-height: 100dvh` under the `100vh` fallback
- `src/pages/auth/Login.css` (edited) — same for `.login-container`
- `src/pages/Home.css` (edited) — same for `.home-container` and `.hero-section` (`calc(100dvh - var(--header-height))`)
- `src/App.jsx` (edited) — `RouteFallback` inline `height: '100dvh'`
- `src/components/ProtectedRoute.jsx` (edited) — loading spinner inline `height: '100dvh'`
- `src/components/AppErrorBoundary.jsx` (edited) — inline `minHeight: '100dvh'`
- `src/pages/member/Bookings.jsx` (edited) — `useMobileViewport` listens to `matchMedia('(max-width: 768px)')` `change`, not `resize`
- `src/pages/admin/Bookings.jsx`, `src/pages/admin/Dashboard.jsx`, `src/pages/admin/Amenities.jsx`, `src/pages/member/Dashboard.jsx` (edited) — `[...arr].sort()` → `arr.toSorted()`
- `src/services/localDevStore.js`, `src/utils/deskPlans.js`, `src/utils/phone.js`, `src/utils/monthlyHours.js`, `src/utils/eventOrder.js` (edited) — same `toSorted` swap
- `src/services/storage.js` (edited) — the five wrapped upload/delete errors pass `{ cause: error }`

## Acceptance
- [ ] Every remaining `100vh` in `src/**/*.css` is a fallback line directly above a `dvh`/`lvh` line
- [ ] No inline style in `src/` uses `100vh`
- [ ] Member Bookings' booking calendar opens on the mobile date stage at ≤ 768px and on the week grid above it
- [ ] An open booking calendar switches between the mobile day grid and the week grid when the viewport crosses 768px
- [ ] `useMobileViewport` removes its `change` listener on unmount
- [ ] No `[...x].sort(` remains where the spread only copies an existing array
- [ ] Admin Bookings, admin Dashboard and member Dashboard list order matches `origin/main`
- [ ] `storage.js` wrapped errors keep the same `message` and expose the Firebase error as `cause`
- [ ] NOT: copy `error.code` onto the wrapped storage errors (no caller reads it; the old wrapper had none)
- [ ] NOT: `Object.groupBy` in `src/` (needs iOS Safari 17.4; the app supports iOS 16.4+)
- [ ] NOT: polyfills or `build.target` changes
- [ ] NOT: `[...new Set(x)].sort()` (`BookingCalendar.jsx`) or `[...arr, item].sort()` (`admin/Amenities.jsx` day toggle), whose spread does more than copy

## Verify
- `npm run lint` → exit 0, 0 warnings
- `npm test` → all pass
- `npm run build` → exit 0
- `grep -rn "100vh" src` → only CSS fallback lines, each followed by a `dvh`/`lvh` line
- `npm run dev:skipauth`, `/member/bookings`, open an amenity's booking modal → resize 800 → 700 → 800 px wide: week grid → `calendar-grid--mobile` day grid → week grid
- same server at 390×844 and 1440×900: `/login`, `/` and `/member` fill the viewport height
- regression: list order on `/admin/bookings`, `/admin` and `/member`, and the `/member` calendar's day items, match `origin/main`

## Notes
Issue: https://github.com/sqrDAO/danang-hub-app/issues/290

- **Targets.** No browserslist; Vite 7's default `build.target` (`baseline-widely-available`) only lowers syntax, never adds APIs. Supported floor is iOS Safari 16.4 (web push). `toSorted` (Safari 16, Chrome 110, Firefox 115), `Error` `cause` (Safari 15, Chrome 93) and `dvh` (Safari 15.4, Chrome 108) all fit; `Object.groupBy` (Safari 17.4, Chrome 117) does not, so item 5 is skipped rather than polyfilled.
- **Inline styles** can't carry a fallback declaration, so they use `100dvh` alone. That is safe at the iOS 16.4 floor and matches existing unguarded `dvh` in `Modal.css` and `AmenityPhotoLightbox.css`; it also keeps `AppErrorBoundary` free of stylesheet dependencies.
- `src/pages/oauth/Consent.css` already had the `dvh` line on `main`; untouched.
- ESLint `ecmaVersion: 'latest'` parses all of this, and these are prototype/constructor features, not globals. Node 22 (`npm test` imports `deskPlans`, `monthlyHours`, `eventOrder`, `phone`) has `toSorted`.
- `matchMedia('(max-width: 768px)')` uses the same layout-viewport width as `innerWidth <= 768`, so the breakpoint is unchanged.
