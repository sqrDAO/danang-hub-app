# Lock the Home wallpaper to the large viewport
**Phase**: — · **Deps**: hero-canvas-lifecycle

## Goal
Mobile browser chrome (URL bar / bottom nav) toggles `innerHeight` on scroll.
The wallpaper must not resize, remount, or jump when that happens.

## Files
- `docs/backlog/todo.hero-canvas-mobile-viewport.md` (new) — this spec.
- `src/utils/lockViewport.js` (new) — measure the canvas box; ignore height-only changes on touch only.
- `src/components/HeroCanvas3D.jsx` (edited) — size from the container via `lockViewport`; skip no-op resizes.
- `src/pages/Home.css` (edited) — container height is `100lvh` from `top: 0`, not `inset: 0`.
- `test/lockViewport.test.js` (new) — height-only ignore / orientation cases.

## Acceptance
- [x] `.hero-3d-canvas-container` is `position: fixed; top/left/right: 0; bottom: auto; height: 100lvh` (`100vh` fallback). Not `inset: 0` and not `100dvh`.
- [x] Renderer size comes from the container box after `lockViewport`, not raw `window.innerHeight`.
- [x] A height-only change (URL bar shown or hidden) does not call `setSize` or remount the scene
      when `(hover: none) and (pointer: coarse)` matches.
- [x] On a pointer device a height-only change refits — a desktop window resize is deliberate,
      not browser chrome, and a stale buffer leaves a strip of bare background under the hero.
- [x] A width change (orientation / desktop resize) uses the new box as-is and still remounts when `gridBounds` cols/rows change.
- [x] NOT: do not listen to `visualViewport`; do not switch `position: fixed` to absolute; do not use `dvh`.
- [x] NOT: do not ratchet height up when chrome hides — that is still a `setSize`.

## Verify
- `npm run lint` → zero warnings.
- `npm test` → `lockViewport` cases pass.
- `npm run build` → succeeds.
- DevTools iPhone / Android: scroll `/` so the browser chrome hides and shows — tiles do not jump or rebuild.
- desktop: drag the window's bottom edge — the wallpaper refits, no bare strip under the hero.
- Rotate the device — wallpaper refits; no gap at the bottom.
- regression: desktop window resize still refits; reduced-motion still skips the canvas.

## Notes
`gridBounds` cols follow aspect ratio, so a ~80px chrome toggle can drop a column
and remount ~300 meshes. Ignoring height-only `resize` is what stops that, not
the debounce. First paint uses `100lvh` so the buffer already covers chrome-hidden.
