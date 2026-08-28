# Hero canvas lifecycle
**Phase**: — · **Deps**: —

## Goal
Harden Home’s Three.js wallpaper so a missing GPU does not throw, unmount releases the WebGL context, and the render loop stops when the tab is hidden or the user prefers reduced motion.

## Files
- `docs/backlog/todo.hero-canvas-lifecycle.md` (new) — this spec.
- `src/components/HeroCanvas3D.jsx` (edited) — try/catch renderer, `forceContextLoss` on cleanup, pause/resume rAF.

## Acceptance
- [x] `new THREE.WebGLRenderer(...)` is inside try/catch; on failure setup returns a no-op cleanup and does not throw out of `useEffect`.
- [x] Unmount calls `renderer.forceContextLoss()` after `dispose()` and then removes the canvas.
- [x] When `document.hidden` is true the loop does not schedule another `requestAnimationFrame`.
- [x] When `prefers-reduced-motion: reduce` matches, the scene renders at most one still frame and does not keep rAF going.
- [x] A live change of that media query or of `document.visibilityState` pauses or resumes the loop.
- [x] A theme toggle while the loop is paused still redraws one still frame with the new palette.
- [x] NOT: do not add an error boundary around `lazy(HeroCanvas3D)`.
- [x] NOT: do not hoist the canvas out of `.hero-section` or change `position: fixed`.

## Verify
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- `npm run dev` → `/` with motion allowed: tiles still wave.
- Playwright: `emulateMedia({ reducedMotion: 'reduce' })` on `/` → after 500ms no new rAF from the canvas; one canvas present; hero copy still visible.
- regression: footer still above tiles; `/` still lazy-loads the canvas.

## Notes
- Keep functions under eslint caps (`complexity` ≤ 10, `max-statements` ≤ 30) by extracting renderer/loop helpers.
