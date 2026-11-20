# Observe Content Security Policy violations

## Goal
Start the report-only rollout for [#196](https://github.com/sqrDAO/danang-hub-app/issues/196). Use browser violation observations to validate the allowlist before a later enforcement change.

## Files
- `firebase.json` — report-only response header for hosted resources.

## Acceptance
- [ ] Hosting sends Content-Security-Policy-Report-Only on application routes.
- [ ] Sources cover Firebase Auth, Firestore, Storage, Functions, FCM and Google Fonts.
- [ ] Inline scripts and eval are reported.
- [ ] Enforcement remains pending deployed flow verification.

## Verify
- Run app lint, build, unit tests and Functions lint.
- Start Firebase Hosting emulator and inspect headers on `/`, `/login`, and `/sw.js`.
- On the deployed preview, preserve the browser console and filter for CSP violations.
- Exercise email/Google/EVM/Solana login, booking, event creation, image upload, push opt-in, reload and offline PWA navigation.
- Record each legitimate blocked origin/directive and the flow before changing the allowlist.
- Test a fresh browser session and an installed PWA after service-worker refresh.
- After report-only production observations pass, follow up with enforcement and repeat these flows.

## Source rationale
- Scripts allow same-origin bundles and Google's `apis.google.com` Auth popup helper.
- Styles allow Google Fonts and inline styles used by React components; fonts allow fonts.gstatic.com.
- Images allow HTTPS for stored member/amenity images and Google avatars, plus data wallet icons and blob upload previews.
- Connections allow named Firebase APIs, Google Auth helpers and the project's us-central1 callable host.
- Frames allow the project's Firebase Auth domain and same-origin auth helpers.
- Workers and manifests use same-origin resources. Objects are disabled; base URLs and form actions are same-origin.
- Wallet signing uses injected providers and Firebase callables.
- Reports are observed in DevTools locally; there is no remote collection endpoint. Capture only directive and origin, omitting user data and URL queries.
- This PR covers the initial rollout. #196 remains open until production enforcement and authenticated flow checks pass.

## Results
- App lint, Functions lint, production build and PWA generation pass.
- Unit tests pass (298 passed, 8 emulator-dependent skips).
- Firebase Hosting emulator serves the report-only header on `/`, `/login` and `/sw.js`, all HTTP 200.
- Deployed browser violation collection and authenticated flows remain pending.
- Build reports existing Wolgen font resolution and large-chunk warnings.
