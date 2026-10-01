# Hero canvas reveal
**Phase**: — · **Deps**: hero-canvas-lifecycle

## Goal
When the lazy `HeroCanvas3D` chunk lands, the full tile grid pops in on one frame over the hero's amber glow; ease it in instead (container fades, tiles settle outward from the center, camera pulls back to rest). Cache that chunk in the service worker after the first visit so repeat boots skip the network wait.

## Files
- `src/components/HeroCanvas3D.jsx` (edited) — per-tile reveal delay by distance from center; `waveTiles` settles tiles from 60% scale; `settleCamera` eases the camera from `CAM_Z - 3` back to `CAM_Z`; container gets `is-ready` on the first frame drawn while the tab is visible; per-tile reveal work stops once the reveal has finished; reduced motion snaps the reveal to its final state.
- `src/pages/Home.css` (edited) — `.hero-3d-canvas-container` opacity transition gated on `.is-ready`.
- `public/sw.js` (edited) — `CacheFirst` runtime route for `/assets/HeroCanvas3D-*.js`, JavaScript responses only.

## Acceptance
- [ ] On first mount, center tiles appear before edge tiles.
- [ ] Each tile grows from 60% scale to full scale.
- [ ] The camera starts the reveal at `CAM_Z - 3`.
- [ ] The camera comes to rest at exactly `CAM_Z`.
- [ ] The camera settle finishes within ~2.7s of animation time.
- [ ] The canvas container fades from opacity 0 to 1.
- [ ] The fade starts after the first WebGL frame is drawn, not on DOM mount.
- [ ] A canvas mounted in a hidden tab starts its fade only when the tab is first shown.
- [ ] Tiles skip the scale update once the reveal has finished.
- [ ] After one visit to `/`, a reload serves `HeroCanvas3D-*.js` from the `hero-canvas-cache` SW cache.
- [ ] NOT: `HeroCanvas3D-*.js` added to the precache manifest.
- [ ] NOT: a non-JavaScript response (Hosting's `index.html` fallback) stored in `hero-canvas-cache`.
- [ ] Tiles rebuilt by a resize after the reveal render at full scale immediately.
- [ ] NOT: a separate placeholder element or extra DOM layer.
- [ ] Reduced motion turned on mid-reveal leaves tiles at full scale and the camera at `CAM_Z`.
- [ ] Reduced motion turned off after loading with it on does not replay the reveal.
- [ ] NOT: changes to quads, particles, palettes, or reduced-motion behavior beyond the reveal snap.

## Verify
- `npm run lint && npm run build && npm test` → green
- `npm run dev`, DevTools Network "Slow 4G", load `/` → amber glow first, then grid fades in, settles outward from center, camera drifts back.
- `npm run build && npm run preview`, load `/`, reload → DevTools Network shows `HeroCanvas3D-*.js` "(ServiceWorker)"; Application → Cache Storage lists `hero-canvas-cache`.
- Open `/` in a background tab, wait 5s, switch to it → grid fades in and settles from 60% (no full-size flash first).
- Resize the window after the reveal ends so the grid gains columns → new edge tiles appear at full scale.
- DevTools Rendering → emulate `prefers-reduced-motion: reduce` within 2s of load → grid snaps to full size, camera at rest; turn emulation off → wave resumes, no shrink or camera jump.
- Load `/` with reduced motion emulated, then turn it off → no 60% replay, no camera jump.
- regression: theme toggle, window resize, tab hide/show on Home behave as before.

## Notes
Reveal is driven by the loop's `elapsed` (animation time), so a hidden tab pauses the reveal rather than skipping it.
