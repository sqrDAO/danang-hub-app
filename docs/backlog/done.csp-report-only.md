# Observe Content Security Policy violations
**Phase**: — · **Deps**: — · **Issue**: #196

## Goal
Start the CSP rollout for #196 with a report-only header, so browsers log what an enforced policy would block. Use those logs to fix the allowlist before a later PR enforces it.

## Files
- `firebase.json` (edited) — `Content-Security-Policy-Report-Only` header on every hosted path

## Acceptance
- [ ] Hosting sends `Content-Security-Policy-Report-Only` on `/`, `/login` and `/sw.js`.
- [ ] `connect-src` allows Firebase Auth, Firestore, Storage, Installations, FCM and the `us-central1` callables.
- [ ] `style-src` and `font-src` allow Google Fonts.
- [ ] `script-src` has no `'unsafe-inline'` or `'unsafe-eval'`, so inline scripts and eval get reported.
- [ ] `object-src` is `'none'`.
- [ ] NOT: an enforcing `Content-Security-Policy` header.
- [ ] NOT: a remote report endpoint (`report-uri` / `report-to`).

## Verify
- `npm run lint && npm run build && npm test` → green (298 pass, 8 emulator-dependent skips)
- `firebase emulators:start --only hosting` then `curl -sI localhost:5000/ | grep -i content-security-policy-report-only` → the header; same for `/login` and `/sw.js`
- on the PR preview, DevTools console filtered for "Content-Security-Policy": no report while doing each of these:
  - email, Google, EVM and Solana sign-in
  - a booking, creating an event with a banner upload, avatar upload
  - push opt-in, reload, offline navigation in the installed PWA

## Notes
- Sources:
  - `apis.google.com` serves the Auth popup helper script.
  - `danang-hub-app.firebaseapp.com` is the auth iframe; a custom `authDomain` on the app's own host is covered by `'self'`.
  - `img-src https: data: blob:` covers stored images, Google avatars, wallet icons and upload previews.
  - Wallet signing uses injected providers, so it needs no extra host.
- `connect-src` names this project's hosts; another Firebase project needs its own.
- Not in the allowlist yet: `images.lumacdn.com`, which the Luma import (#208) fetches. Add it before enforcing.
- Record each legitimate report (directive and origin only, no user data or query strings) before changing the allowlist. #196 stays open until enforcement ships.
- Existing build warnings (unresolved Wolgen font URLs, large chunks) are unchanged.
