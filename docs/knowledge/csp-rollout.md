# CSP enforcement rollout (#196)

The enforcement branch promotes the existing Hosting policy; production remains
report-only until this PR is merged and deployed. Keep the PR draft until the
matrix below has real browser evidence. Unit tests do not exercise CSP.

## Policy boundaries

- Scripts: same origin and Firebase Auth's `apis.google.com` helper only; no
  inline scripts or eval. This origin allowlist is not a nonce/hash strict CSP.
- Styles retain inline support for React styles and Google Fonts. Fonts use
  `fonts.gstatic.com`; HTTPS images, blobs and data images remain supported.
- Connections name Firebase services and the pinned us-central1 callable host.
  Cover downloads name `images.lumacdn.com`, `secure-content.meetupstatic.com`
  and `img.evbuc.com` (the latter two also support pending PR #247).
- Auth frames allow this project's firebaseapp.com domain and same origin.
  Workers/manifests are same-origin; objects are forbidden; base URLs, forms
  and embedding ancestors are restricted to same origin.
- Wallet signing uses injected providers. Do not add arbitrary wallet origins
  to fix extension-generated violations.
- There is no remote report collector. Inspect DevTools Console/Issues and
  Network with Preserve log enabled. Record directive and origin only, never
  tokens, query strings, account details or script samples.

## Release verification

Use the Firebase Hosting PR preview (Vite dev does not send Hosting headers).
Use a test account and authorized test records. Record browser/version, date,
preview commit, result and sanitized violations in this table before readiness.
An unavailable provider is **pending**, not a pass.

| Check | Result |
| --- | --- |
| `/`, `/login`, `/sw.js`: enforcing header present; report-only absent | Pending |
| Public home, login, event list/detail load without CSP violations | Pending |
| Email sign-in and sign-out | Pending |
| Google popup/redirect sign-in and sign-out | Pending |
| EVM and Solana signature sign-in | Pending |
| Booking availability, create and cancel own test booking | Pending |
| Event create/edit with uploaded banner; avatar upload | Pending |
| Luma cover import; Meetup/Eventbrite after #247 lands | Pending |
| Push opt-in and receipt of a test notification | Pending |
| Installed PWA reload and offline navigation, including worker update | Pending |

For each failed request distinguish CSP blocking from CORS, auth-domain
authorization and backend errors. Add an origin only after tracing it to a
required app dependency; rerun the affected flow. Never weaken script-src to
`unsafe-inline`, `unsafe-eval` or a blanket HTTPS allowlist.

After approval/merge, verify CI and the production Hosting deployment, repeat
the header checks and smoke flows in a fresh tab and an existing installed PWA.
Only then close #196. The policy also applies to the service-worker response;
existing cached documents may retain the previous policy until refreshed.

## Rollback

If legitimate flows fail, change the header key in `firebase.json` back to
`Content-Security-Policy-Report-Only` in a revert PR and redeploy Hosting using
the normal production workflow. Retain the allowlist for diagnosis. Confirm
the report-only header on `/`, `/login` and `/sw.js`, then reload affected
clients. Do not roll back Firestore rules or authentication checks.
