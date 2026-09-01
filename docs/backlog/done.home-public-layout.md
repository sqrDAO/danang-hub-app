# Home public layout around the wallpaper
**Phase**: — · **Deps**: hero-canvas-lifecycle

## Goal
The wallpaper is `position: fixed` behind the page. Public Home needs stacking,
leftover-card centering, and footer/auth chrome so copy is not painted over and
logged-in mobile `/` keeps the bottom nav.

## Files
- `src/components/Footer.css` (edited) — `z-index: 2`; opaque `--bg-color` (drops glass so tiles do not show through).
- `src/components/Footer.jsx` (edited) — `isAuthenticated` from `currentUser`, not path.
- `src/components/Layout.jsx` (edited) — `layout--public` vs `layout--app`; `flush` prop for Home.
- `src/components/Layout.css` (edited) — main keeps the bottom spacer by default, `layout--flush` drops it;
  logged-out public Home has no bottom-nav spacer.
- `src/pages/Home.jsx` (edited) — `<Layout public flush>`; extract preview cards; `loginPath` via `URLSearchParams`.
- `src/pages/Home.css` (edited) — leftover grid centering; `hero-enter` under `no-preference`.

## Acceptance
- [x] Footer `z-index: 2` so logo/copy/links paint above the tiles.
- [x] Footer background is opaque `var(--bg-color)` with no `backdrop-filter`.
- [x] Logged-in mobile `/` applies `footer--authenticated` (`display: none`); BottomNav still keys off `currentUser`.
- [x] Logged-out mobile `/` still shows the marketing footer.
- [x] Desktop leftover preview card (1 item, or odd 3rd) centers at one-column width (`min-width: 769px`).
- [x] Hero title/subtitle/cta entrance animation is inside `@media (prefers-reduced-motion: no-preference)`.
- [x] `loginPath` encodes via `URLSearchParams`.
- [x] NOT: do not restore footer glass — canvas bleed-through is why it went opaque.
- [x] Only Home drops the `--spacing-xl` spacer above the footer; public `/events` and `/amenities` keep it.
- [x] NOT: do not change `/member` or `/admin` bottom-nav padding.

## Verify
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- desktop `/`: footer sits above the tiles; 1 past-event card and a 3rd amenity are centered.
- mobile `/` logged-in: marketing footer hidden, bottom nav visible.
- mobile `/` logged-out: footer still shows, no bottom nav.
- desktop `/events` and `/amenities` (public): the last card still clears the footer by ~4rem.
- regression: `/member` desktop still has a footer; `/member` mobile still hides it for the bottom nav.
- reduced-motion: hero copy visible with no entrance animation.

## Notes
The opaque footer is shared chrome (`/member`, `/admin` too), not Home-only.
Auth `loading` flash is not in this spec.
