# Recover from stale lazy chunks after a deploy
**Phase**: — · **Deps**: —

## Goal
A tab still running the old build asks for a lazy page chunk the new deploy removed,
Hosting answers with `index.html`, and the uncaught import error blanks the screen
(issue #139). Reload once into the new build on that error, and show a Reload
fallback instead of a white screen for anything still uncaught.

## Files
- `src/utils/chunkReload.js` (new) — pure `shouldReloadForStaleChunk(lastReloadAt, now)`
  guard: true when there was no earlier reload or it was more than 10 s ago.
- `test/chunkReload.test.js` (new) — guard cases.
- `src/main.jsx` (edited) — `vite:preloadError` listener: read/write the last reload
  time in `sessionStorage` (try/catch), reload when the guard allows; wrap `<App />`
  in the boundary.
- `src/components/AppErrorBoundary.jsx` (new) — class error boundary; fallback asks
  the member to reload the page and has a Reload button.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — fallback strings.
- `src/styles/globals.css` (edited, only if needed) — fallback card via existing CSS vars.

## Acceptance
- [ ] A `vite:preloadError` reloads the page.
- [ ] A second `vite:preloadError` within 10 s of that reload does not reload again.
- [ ] A `vite:preloadError` more than 10 s after the last reload reloads again.
- [ ] Blocked `sessionStorage` does not throw out of the listener.
- [ ] A render error anywhere under `<App />` shows the fallback, not a white screen.
- [ ] The fallback's Reload button reloads the page.
- [ ] The fallback text exists in EN and VI.
- [ ] The fallback is readable in light and dark theme.
- [ ] NOT: the fallback text does not mention versions, deploys or error details.
- [ ] NOT: no change to `public/sw.js` or the `registerSW` call (issue #143).
- [ ] NOT: no change to HeroCanvas3D's own `.catch` in `src/pages/Home.jsx`.

## Verify
- `npm run lint && npm run build && npm test` → all green
- `npm run build && npm run preview`, open /login in a tab; change a string in
  `src/pages/member/Events.jsx`, `npm run build` again; in the open tab sign in and go
  to /member/events → the page reloads once and Events loads; no white screen
- same tab, DevTools console: `window.dispatchEvent(new Event('vite:preloadError'))`
  twice in a row → only the first reloads
- `npm run dev`, temporarily `throw new Error('x')` in a page component → the fallback
  shows in EN and VI, light and dark; Reload reloads; remove the throw
- regression: Home still loads without the 3D wallpaper when HeroCanvas3D fails;
  push opt-in banner and toasts still render

## Notes
The 10 s window, not a one-shot flag, so a second deploy later in the same session
still recovers, while a chunk that is broken in the new build too cannot loop.

Auto-reload is silent on purpose: the failure only happens when navigating to a new
page, so there is no half-filled form to lose.

Root-cause alternative (drop `skipWaiting`, prompt to update) belongs to #143; this
spec is the safety net either way, and also covers tabs without a service worker.
