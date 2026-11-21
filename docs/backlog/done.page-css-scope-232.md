# Isolate lazy-loaded page styles
**Phase**: — · **Deps**: —

## Goal
Fix [#232](https://github.com/sqrDAO/danang-hub-app/issues/232): loading a route must not restyle another route.
Scope route styles without increasing selector specificity or changing shared component ownership.

## Files
- `src/pages/auth/Login.css` (edited) — isolate login form styles and animations.
- `src/pages/Home.css` (edited) — isolate home section styles.
- `src/pages/member/Events.css` (edited) — isolate event badges and actions.
- `src/pages/member/Events.jsx` (edited) — identify route root.
- `src/pages/admin/Events.css` (edited) — isolate admin event styles.
- `src/pages/admin/Events.jsx` (edited) — identify route root.
- `src/pages/member/Bookings.css` (edited) — isolate booking and amenity styles.
- `src/pages/member/Bookings.jsx` (edited) — identify route root.
- `src/pages/admin/Bookings.css` (edited) — isolate admin booking styles.
- `src/pages/admin/Bookings.jsx` (edited) — identify route root.
- `src/pages/member/Dashboard.css` (edited) — isolate member dashboard styles.
- `src/pages/admin/Dashboard.css` (edited) — isolate admin dashboard styles.
- `src/pages/admin/Dashboard.jsx` (edited) — identify route root.
- `src/pages/admin/Amenities.css` (edited) — isolate amenity management styles.
- `src/pages/admin/Amenities.jsx` (edited) — identify route root.
- `src/pages/admin/Members.css` (edited) — isolate roster styles.
- `src/pages/admin/Members.jsx` (edited) — identify route root.

## Acceptance
- [ ] Booking approved badges remain amber after visiting Events.
- [ ] Profile labels retain their typography after Login has loaded.
- [ ] Admin and member route styles cannot match another route's elements.
- [ ] Route dialogs retain styles under their owning DOM root.
- [ ] Responsive and light-theme selectors retain their conditions.
- [ ] NOT: change shared Profile.css ownership or shared component styles.
- [ ] NOT: change booking, event or authentication behavior.

## Verify
- `npm run lint` → passes.
- `npm test` → passes.
- `npm run build` → passes.
- `npm --prefix functions run lint` → passes.
- `git diff --check` → passes.
- Fixture browser: navigate Events → Bookings; check approved badge color.
- Browser: load Login then Profile in one SPA session; check label typography.
- Regression: desktop/mobile Events, booking dialog, admin amenities and dashboards.

## Notes
Use zero-specificity `:where()` ancestors to preserve component overrides.
Native dialogs stay in the route DOM even when displayed in the top layer.
Profile.css is deliberately imported by profiles, host dialogs, dashboards and verification.
