# Recover from stale lazy chunks after a deploy
**Phase**: — · **Deps**: —

## Goal
A tab still running the old build asks for a lazy page chunk the new deploy removed,
Hosting answers with `index.html`, and the uncaught import error blanks the screen
(issue #139). Reload once into the new build on that error, and show a Reload
fallback instead of a white screen for anything still uncaught.

## Files
- `src/utils/chunkReload.js` (new) — pure `shouldReloadForStaleChunk({ error, online,
  reloadedBuild, currentBuild })` guard and `isOptionalChunkError(error)`.
- `test/chunkReload.test.js` (new) — guard cases.
- `src/main.jsx` (edited) — `vite:preloadError` listener: read/write the build id
  (`APP_COMMIT@APP_BUILT_AT`) that last reloaded in `sessionStorage` (try/catch),
  reload when the guard allows; wrap `<App />` in the boundary.
- `src/components/AppErrorBoundary.jsx` (new) — class error boundary; fallback asks
  the member to reload the page and has a Reload button; `componentDidCatch` logs
  `[AppErrorBoundary]` to the console.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — fallback strings.

## Acceptance
- [ ] A `vite:preloadError` for a page chunk reloads the page.
- [ ] A second `vite:preloadError` in the same build does not reload again.
- [ ] A `vite:preloadError` in a later build (new deploy) reloads again.
- [ ] A `vite:preloadError` while `navigator.onLine === false` does not reload.
- [ ] A failing HeroCanvas3D chunk does not reload; Home loads without the wallpaper.
- [ ] Blocked `sessionStorage` does not throw out of the listener.
- [ ] A render error anywhere under `<App />` shows the fallback, not a white screen.
- [ ] A non-stale render error still shows the fallback and logs `[AppErrorBoundary]`.
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
- preview, DevTools Network → block request URL `*HeroCanvas3D*`, open / → Home loads
  without the wallpaper, no reload, no fallback
- preview, open /login, DevTools Network → Offline, navigate to / → no reload loop;
  Home renders without the wallpaper
- `npm run dev`, temporarily `throw new Error('x')` in a page component → the fallback
  shows in EN and VI, light and dark; console shows `[AppErrorBoundary]`; Reload
  reloads; remove the throw
- regression: push opt-in banner and toasts still render

## Notes
Every deploy changes every page chunk's hash, not only edited pages: the entry chunk
carries `__APP_COMMIT__` and `__APP_BUILT_AT__`, and page chunks import from it. So
any lazy page can fail in an old tab after any deploy.

Once per build id, not a one-shot flag, so a second deploy later in the same session
still recovers, while a chunk that is broken in the new build too cannot loop (at
most one extra reload). The id includes `__APP_BUILT_AT__` so two local builds of
one commit differ. HeroCanvas3D is matched by name in the import error message
(Chrome/Firefox include the chunk URL); Safari's message has no URL, so there only
the offline check protects it. HeroCanvas3D is not precached (vite.config.js).
If `sessionStorage` is blocked the listener cannot record a reload, so it does not
reload at all and the error falls through to the Reload fallback.

Auto-reload is silent on purpose: the failure only happens when navigating to a new
page, so there is no half-filled form to lose.

Root-cause alternative (drop `skipWaiting`, prompt to update) belongs to #143; this
spec is the safety net either way, and also covers tabs without a service worker.
