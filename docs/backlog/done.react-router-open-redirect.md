# Close the react-router open-redirect advisory
**Phase**: — · **Deps**: bump-audit-fixable-dependencies

## Goal
Root `npm audit` still flags `react-router` 6.30.6: GHSA-wrjc-x8rr-h8h6 (open redirect via a
backslash path in `<Link>`/`useNavigate`) and GHSA-337j-9hxr-rhxg (SSR hydration). Both patch
only in 7.18+. The first is reachable here: `src/pages/auth/Login.jsx` passes the
`?redirect=` query param to `navigate()` unvalidated, so a crafted login link can bounce a
member off-site after sign-in.

## Files
- `src/utils/safeRedirect.js` (new) — `toSafeRedirectPath(value)`: return the value only if
  it is an in-app path (starts with a single `/`, no `//`, no `\`, no scheme); else `null`.
- `src/pages/auth/Login.jsx` (edited) — run `redirect` through `toSafeRedirectPath`; fall
  back to the `/admin` / `/member` default when it returns `null`.
- `test/safeRedirect.test.js` (new) — cases for the helper.

## Acceptance
- [ ] `/login?redirect=/member/bookings` still lands on `/member/bookings` after sign-in.
- [ ] `/login?redirect=//evil.example` lands on the role default route.
- [ ] `/login?redirect=/\evil.example` lands on the role default route.
- [ ] `/login?redirect=https://evil.example` lands on the role default route.
- [ ] Existing `amenityId` / `eventId` / `action` query passthrough is unchanged.
- [ ] NOT: upgrading to react-router v7 — that is a separate migration (16 files import
      `react-router-dom`; needs a v7 future-flags pass first).
- [ ] NOT: marking GHSA-337j-9hxr-rhxg as fixed — the app is a client-only SPA
      (`BrowserRouter`, no SSR hydration), so it is not reachable; record that, don't patch it.

## Verify
- `npm test` → `test/safeRedirect.test.js` passes; existing suite unchanged.
- `npm run lint && npm run build` → clean.
- `npm run dev`, signed out: open each Acceptance URL, sign in → lands as stated.
- regression: amenity "book now" and event "register" links from public pages still
  round-trip through login to the intended action.

## Notes
`npm audit` will keep listing both advisories until the v7 bump; this spec closes the
reachable risk, not the audit line.
