# Serve the cached app shell for page loads in the service worker
**Phase**: — · **Deps**: stale-chunk-recovery

## Goal
`public/sw.js` only precaches exact file URLs, so reloading any page other than `/`, or
opening a push or email deep link, goes to the network and shows the browser's offline
page when the connection is weak or gone (issue #140). Answer page loads with the
precached `index.html`, as Hosting's `**` rewrite already does online.

## Files
- `public/sw.js` (edited) — register a `NavigationRoute` bound to the precached
  `index.html`, right after `precacheAndRoute`, with a denylist for `/__/` and file URLs.

## Acceptance
- [ ] Offline, reloading `/member/bookings` in the installed app shows the app, not the browser's offline page.
- [ ] Offline, a push notification click to `/member/events` opens the app on that page.
- [ ] Online, a deep link opens from the cached shell without waiting for the network.
- [ ] `/__/auth/handler` still reaches the network (Firebase Auth popup).
- [ ] Opening `/sw.js` in a tab shows the raw file, not the app.
- [ ] NOT: no network-first strategy or timeout for page loads.
- [ ] NOT: no change to `skipWaiting`, `registerSW` or update prompts (issue #143).
- [ ] NOT: no offline data (Firestore persistence); offline shows the app without data.

## Verify
- `npm run lint && npm run build && npm test` → all green
- `grep -o 'denylist:\[.\{0,40\}' dist/sw.js` → shows both denylist patterns
- `grep -o '"url":"index.html"' dist/sw.js` → one match (the shell is precached)
- `npm run preview`, open `/`, wait for the SW to activate; DevTools Network → Offline,
  open `/member/bookings` and reload → the app renders (login or bookings page)
- same preview, Offline, open `/sw.js` → browser offline page (not the app)
- PR preview channel: open `/__/auth/handler` in a tab → Firebase's handler page, not the app;
  sign in with Google → succeeds
- regression: push click deep links still focus/navigate the open tab; after a second
  deploy, an open deep link reloads once into the new build (stale-chunk-recovery)

## Notes
Precache routing maps `/` to `/index.html` (`directoryIndex`) but `/member/bookings` to
`/member/bookings.html`, which does not exist, so only `/` works offline today.

`/__/` is Firebase-reserved: Google sign-in uses `signInWithPopup`, which loads
`/__/auth/handler` and `/__/auth/iframe` on `authDomain`. Hosting serves the app on
`*.firebaseapp.com` too, so without the denylist the SW would answer the popup with the app.

`createHandlerBoundToURL` throws at SW startup if `index.html` is not precached, which
stops the whole SW, push included. Keep `html` in `globPatterns` (`vite.config.js`).

Cache-first shell means the first page load after a deploy runs the old build until the
new SW activates and deletes its chunks; the stale-chunk-recovery reload covers that.
