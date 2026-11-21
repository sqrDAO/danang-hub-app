# CSP enforcement rollout (#196)

Production enforces the Hosting CSP after [#248](https://github.com/sqrDAO/danang-hub-app/pull/248)
merged on 2026-11-21. Deployment is complete, but the browser verification matrix
is only partially covered: keep #196 open until the remaining flows pass. Unit
tests do not exercise browser CSP enforcement.

## Policy boundaries

- Scripts: same origin and Firebase Auth's `apis.google.com` helper only; no
  inline scripts or eval. This origin allowlist is not a nonce/hash strict CSP.
- Styles retain inline support for React styles and Google Fonts. Fonts use
  `fonts.gstatic.com`; HTTPS images, blobs and data images remain supported.
- Connections name Firebase services and the pinned us-central1 callable host.
  Cover downloads name `images.lumacdn.com`, `secure-content.meetupstatic.com`
  and `img.evbuc.com` (the latter two support the imports merged in #247).
- Auth frames allow this project's firebaseapp.com domain and same origin.
  Workers/manifests are same-origin; objects are forbidden; base URLs, forms
  and embedding ancestors are restricted to same origin.
- Wallet signing uses injected providers. Do not add arbitrary wallet origins
  to fix extension-generated violations.
- There is no remote report collector. Inspect DevTools Console/Issues and
  Network with Preserve log enabled. Record directive and origin only, never
  tokens, query strings, account details or script samples.

## Release verification

For policy changes, first use the Firebase Hosting PR preview (Vite dev does not
send Hosting headers), then repeat on production after deployment. Use a test
account and authorized test records. Record browser/version, date, environment,
commit, result and sanitized violations. An unavailable provider is **pending**,
not a pass.

### Production evidence — 2026-11-21

Checks used `https://app.danangblockchainhub.com` on commit `e889121`
(the #249 deployment, which includes #248). The [production workflow](https://github.com/sqrDAO/danang-hub-app/actions/runs/44901477940)
and [Firestore rules tests](https://github.com/sqrDAO/danang-hub-app/actions/runs/44901477963)
passed. These CI results do not prove browser flow compatibility.

Curl checks returned HTTP 200 with `Content-Security-Policy` and no
`Content-Security-Policy-Report-Only` for `/`, `/login` and `/sw.js`. In Chrome
(version not recorded), an existing signed-in session navigated from home to
Profile, where member information and MCP token controls rendered; the admin
Bookings heading was also visible. No Content Security Policy errors appeared
in the captured logs for this limited navigation. Logs did contain an extension
`ethereum` redefinition error and a `THREE.Clock` deprecation warning; neither
establishes a CSP failure. This was not a fresh sign-in or write-flow test.

| Check | Result |
| --- | --- |
| `/`, `/login`, `/sw.js`: enforcing header present; report-only absent | Passed: production curl checks, 2026-11-21 |
| Home, login, event list/detail load without CSP violations | Partial: signed-in home rendered; fresh public/login/event browser flows pending |
| Existing signed-in Profile and admin Bookings navigation | Partial: Profile/member/MCP controls rendered and Bookings heading visible; no CSP errors in captured logs |
| Email sign-in and sign-out | Pending |
| Google popup/redirect sign-in and sign-out | Pending |
| EVM and Solana signature sign-in | Pending |
| Booking availability, create and cancel own test booking | Pending |
| Event create/edit with uploaded banner; avatar upload | Pending |
| Luma, Meetup and Eventbrite cover import | Pending |
| Push opt-in and receipt of a test notification | Pending |
| Installed PWA reload and offline navigation, including worker update | Pending |

For each failed request distinguish CSP blocking from CORS, auth-domain
authorization and backend errors. Add an origin only after tracing it to a
required app dependency; rerun the affected flow. Never weaken script-src to
`unsafe-inline`, `unsafe-eval` or a blanket HTTPS allowlist.

For each future policy change, verify CI and the production Hosting deployment,
then repeat the header checks and smoke flows in a fresh tab and an existing
installed PWA. For the current rollout, complete all pending matrix entries
before closing #196. The policy also applies to the service-worker response;
existing cached documents may retain the previous policy until refreshed.

## Rollback

If legitimate flows fail, change the header key in `firebase.json` back to
`Content-Security-Policy-Report-Only` in a revert PR and redeploy Hosting using
the normal production workflow. Retain the allowlist for diagnosis. Confirm
the report-only header on `/`, `/login` and `/sw.js`, then reload affected
clients. Do not roll back Firestore rules or authentication checks.
