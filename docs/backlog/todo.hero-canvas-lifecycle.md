# Home 3D wallpaper
**Phase**: — · **Deps**: —

## Goal
Add a lazy Three.js wallpaper behind the public Home hero. A missing GPU must
not throw, unmount must release WebGL, the PWA precache must not include the
chunk, and `prefers-reduced-motion: reduce` must not download or build the scene.

## Files
- `docs/backlog/todo.hero-canvas-lifecycle.md` (new) — this spec.
- `package.json` (edited) — add `three`.
- `src/components/HeroCanvas3D.jsx` (new) — scene, palettes, try/catch renderer, pause/resume, dispose.
- `src/hooks/usePrefersReducedMotion.js` (new) — media-query hook for the import-site gate.
- `src/pages/Home.jsx` (edited) — lazy import with `.catch()`; do not mount the canvas when reduced motion matches.
- `src/pages/Home.css` (edited) — `.hero-3d-canvas-container` is `position: fixed; pointer-events: none`.
- `vite.config.js` (edited) — `globIgnores` the HeroCanvas3D chunk.

## Acceptance
- [x] `three` is a client dependency; Home lazy-imports `HeroCanvas3D`.
- [x] A rejected `lazy(HeroCanvas3D)` import is swallowed (`.catch()` → no-op default); Home still renders.
- [x] Canvas is `pointer-events: none` and `position: fixed` behind the hero copy.
- [x] `new THREE.WebGLRenderer(...)` is inside try/catch; on failure setup returns a no-op cleanup and does not throw out of `useEffect`.
- [x] Unmount calls `renderer.forceContextLoss()` after `dispose()` and then removes the canvas.
- [x] When `document.hidden` is true the loop does not schedule another `requestAnimationFrame`.
- [x] Home does not render `<HeroCanvas3D />` when `prefers-reduced-motion: reduce` matches — no chunk fetch, no WebGL context, no scene build.
- [x] A live change of that media query mounts or unmounts the canvas at Home.
- [x] A theme toggle while the loop is paused (hidden tab) still redraws one still frame with the new palette.
- [x] `injectManifest.globIgnores` excludes `**/HeroCanvas3D*.js`; the built service-worker manifest does not list that chunk.
- [x] The wave clock accumulates clamped `getDelta()` (max 0.1s); a hidden-tab resume does not jump by the time away.
- [x] Light-theme particles use `NormalBlending` and a darker `PALETTES.light.particle` so they read on the cream background.
- [x] `usePrefersReducedMotion` does not call `matchMedia` when it is missing.
- [x] NOT: do not add an error boundary around `lazy(HeroCanvas3D)` — swallow a failed dynamic import with `.catch()`, not an ErrorBoundary.
- [x] NOT: do not hoist the canvas out of `.hero-section` or change `position: fixed`.
- [x] NOT: do not drop the wallpaper, move `three` into `manualChunks`, or change `globPatterns`.

## Verify
- `npm run lint` → zero warnings.
- `npm run build` → succeeds; `dist/sw.js` precache has no `HeroCanvas3D` URL; `dist/assets/HeroCanvas3D-*.js` still exists.
- DevTools Offline on `/` (installed PWA) → landing still renders; wallpaper may be missing.
- `npm run dev` → `/` with motion allowed: tiles still wave.
- DevTools emulate `prefers-reduced-motion: reduce` on `/` → no `.hero-3d-canvas-container`; Network has no `HeroCanvas3D` request; hero copy still visible.
- Toggle reduced motion off → canvas mounts and tiles wave.
- regression: footer still above tiles; `/` still lazy-loads the canvas when motion is allowed.

## Notes
In-component rAF pause on `state.reduced` stays as a backstop if the canvas is
mounted while reduce is on. The cost gate is the Home import site, not that pause.
