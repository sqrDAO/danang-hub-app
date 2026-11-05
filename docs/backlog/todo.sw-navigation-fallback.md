# Serve the cached app shell for page loads in the service worker
**Phase**: — · **Deps**: stale-chunk-recovery

## Goal
`public/sw.js` only precaches exact file URLs, so reloading any page other than `/`, or
opening a push or email deep link, goes to the network and shows the browser's offline
page when the connection is weak or gone (issue #140). Page loads go to the network first
and fall back to the precached `index.html` when the network fails or takes over 5 seconds.

## Files
- `public/sw.js` (edited) — register a network-first `NavigationRoute` that falls back to
  the precached `index.html`, right after `precacheAndRoute`, with a denylist for `/__/`.

## Acceptance
- [ ] Offline, reloading `/member/bookings` in the installed app shows the app, not the browser's offline page.
- [ ] Offline, a push notification click to `/member/events` opens the app on that page.
- [ ] Online, a page load gets `index.html` from the network, not from the cache.
- [ ] A page load whose network response takes over 5 seconds gets the precached shell.
- [ ] `/__/auth/handler` never gets the precached shell (Firebase Auth popup).
- [ ] Online, opening `/sw.js` in a tab shows the raw file, not the app.
- [ ] If `index.html` is missing from the precache, the service worker still installs.
- [ ] NOT: no change to `skipWaiting`, `registerSW` or update prompts (issue #143).
- [ ] NOT: no Firestore offline persistence.
- [ ] NOT: no page HTML cached at runtime; the only shell is the precached `index.html`.

## Verify
- `npm run lint && npm run build && npm test` → all green
- `grep -o '"url":"index.html"' dist/sw.js` → one match (the shell is precached)
- `npm run preview`, open `/`, wait for the SW to activate; DevTools Network → Offline,
  open `/member/bookings` and reload → the app renders (login or bookings page)
- same preview, online: reload `/member/bookings` → DevTools shows the document from the
  network (not "(ServiceWorker)" from cache storage)
- same preview, online: open `/sw.js` → the raw file
- PR preview channel: open `/__/auth/handler` in a tab → Firebase's handler page, not the app;
  sign in with Google → succeeds
- regression: push click deep links still focus/navigate the open tab; after a second
  deploy, the first page load runs the new build with no forced reload

## Notes
Precache routing maps `/` to `/index.html` (`directoryIndex`) but `/member/bookings` to
`/member/bookings.html`, which does not exist, so only `/` works offline today.

Network first, not cache first: a cached shell lists the previous build's chunks, which
the new SW deletes on activate (`skipWaiting`), so cache first forced a reload on the
first lazy route after every deploy. The 5-second timeout is a product choice for weak
connections; the fallback shell always matches the active SW's precached chunks.

The shell is read with `matchPrecache` per request, not `createHandlerBoundToURL` at
startup, which throws when `index.html` is not precached and stops the whole SW, push
included. Keep `html` in `globPatterns` (`vite.config.js`) anyway.

`/__/` is Firebase-reserved: Google sign-in uses `signInWithPopup`, which loads
`/__/auth/handler` and `/__/auth/iframe` on `authDomain`. Hosting serves the app on
`*.firebaseapp.com` too, so on a slow network the popup could otherwise get the app.
Other file URLs need no denylist: online they reach the network first.

Not covered: a tab opened before a deploy that goes offline after it. The new SW has
already deleted the old chunks (`skipWaiting`, same as on `main`), so lazy routes fail.
