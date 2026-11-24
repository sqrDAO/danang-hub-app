# MCP OAuth sign-in: design

Issue #263 · spec `docs/backlog/done.mcp-oauth.md` · status: phases 0–4 shipped 2026-11-23 (phase 4: CIMD allowlist and ChatGPT verification).

Goal: a member adds `https://app.danangblockchainhub.com/mcp` as a Claude
(web, Desktop, mobile) custom connector or a ChatGPT app, signs in with their
Hub account in the portal, approves, and is connected. No pasted token.
Personal `dhm_` tokens keep working for Claude Code, OpenClaw and Hermes.

## What the clients require (checked 2026-11-22)

Sources: MCP authorization spec 2025-11-25 (current; supersedes 2025-06-18),
claude.com/docs/connectors/building/authentication, developers.openai.com/apps-sdk/build/auth.

| Requirement | MCP spec | Claude | ChatGPT |
| --- | --- | --- | --- |
| 401 + `WWW-Authenticate: Bearer resource_metadata="…"` | MUST (or well-known) | Required to start sign-in; without it and with 404 well-knowns → "Couldn't reach the MCP server" (today's failure) | Yes |
| Protected resource metadata (RFC 9728) `resource` | MUST | Must equal the URL the user typed, path included | Sent back as `resource` |
| `authorization_servers` | MUST | Uses only the first entry | Issuer must match AS `issuer` exactly |
| AS metadata (RFC 8414 or OIDC) | MUST one | Reachable from 160.79.104.0/21 | Yes |
| PKCE | S256 | Always S256; `code_challenge_methods_supported: ["S256"]` must be present | Must include S256 |
| Resource indicators (RFC 8707) | Client MUST send; server MUST check audience | Sends | Sends; copy into audience |
| Registration | CIMD SHOULD, DCR MAY | CIMD only if `client_id_metadata_document_supported: true` **and** `none` in `token_endpoint_auth_methods_supported`, else DCR (new client per fresh connection). Hosted apps: `https://claude.ai/oauth/mcp-oauth-client-metadata`; Claude Code: `https://claude.ai/oauth/claude-code-client-metadata` (checked 2026-11-23) | Prefers CIMD (`https://chatgpt.com/oauth/client.json` when the AS supports RFC 9207, else `https://chatgpt.com/oauth/{callback_id}/client.json`), else DCR (once per connection) |
| Redirect URIs | Exact match; HTTPS or loopback | `https://claude.ai/api/mcp/auth_callback` (may move to `https://claude.com/api/mcp/auth_callback`); Claude Code: loopback `http://localhost:<any>/callback`, `http://127.0.0.1:<any>/callback` | `https://chatgpt.com/connector_platform_oauth_redirect` when AS supports RFC 9207 `iss`, else `https://chatgpt.com/connector/oauth/{callback_id}` |
| RFC 9207 `iss` in authorization response | — | — | Needed for the stable redirect; must be in success **and** error responses |
| Refresh | Public clients MUST rotate | Refreshes on 401 and 5 min before expiry; `invalid_grant` on dead refresh; appends `offline_access` if AS lists it | Plan for rotation |
| Token endpoint | — | `application/x-www-form-urlencoded`; 10 s budget (30 s refresh) | — |
| Consent screen | MUST show redirect hostname; warn on loopback-only | Same | — |

## Recommended architecture

### 1. One origin: `app.danangblockchainhub.com` via Hosting rewrites

Canonical resource: `https://app.danangblockchainhub.com/mcp`. Issuer:
`https://app.danangblockchainhub.com` (no path, so clients find
`/.well-known/oauth-authorization-server` directly). Add to `firebase.json`
`hosting.rewrites`, **before** the `**` → `/index.html` catch-all:

| Source | Target |
| --- | --- |
| `/mcp` | function `mcp` (us-central1) |
| `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp` | function `oauth` |
| `/.well-known/oauth-authorization-server` | function `oauth` |
| `/oauth/register`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke` | function `oauth` |
| `/oauth/consent-action` (consent page's POST, phase 3) | function `oauth` |

The consent UI is the SPA route `/oauth/consent` (served by the catch-all).
Why not the raw `cloudfunctions.net/mcp` URL: its origin cannot serve
`/.well-known/*`, and a branded URL survives a future region move. The raw URL
keeps working for `dhm_` tokens only (decision 1). The same `mcp` function
serves both URLs, so it adds `resource_metadata` to a 401 only when the request
arrived through Hosting (`x-forwarded-host` is `app.danangblockchainhub.com`);
on the raw URL the 401 stays as today, and `dha_` tokens are rejected there.
Hosting forwards `Authorization` and POST bodies; all responses keep
`Cache-Control: no-store` so the CDN never caches them. Hosting rewrites cap at
60 s, same as the `mcp` timeout.

### 2. Authorization server in Cloud Functions, not an external provider

A new `oauth` HTTPS function (`functions/oauth/*.js`, no MCP SDK, lazy
requires) implements the OAuth 2.1 subset MCP needs. Members already live in
Firebase Auth (email, Google, wallet custom tokens), and Firebase Auth is not
an OAuth authorization server for third parties, so an external IdP (Auth0,
Stytch, WorkOS, Descope) would mean a second user store plus account linking
for wallet users, and a vendor bill. The in-house AS is ~5 endpoints, uses the
same hashed-token pattern as `mcpTokens.js`, and reuses `requireUser`.
Trade-off: we own the security of it; mitigated by the narrow feature set
(public clients only, no implicit/password/client_credentials grants, no OIDC
id_tokens) and tests per endpoint.

AS metadata:

```json
{"issuer": "https://app.danangblockchainhub.com",
 "authorization_endpoint": ".../oauth/authorize",
 "token_endpoint": ".../oauth/token",
 "registration_endpoint": ".../oauth/register",
 "revocation_endpoint": ".../oauth/revoke",
 "response_types_supported": ["code"],
 "grant_types_supported": ["authorization_code", "refresh_token"],
 "code_challenge_methods_supported": ["S256"],
 "token_endpoint_auth_methods_supported": ["none"],
 "scopes_supported": ["bookings", "offline_access"],
 "authorization_response_iss_parameter_supported": true,
 "client_id_metadata_document_supported": true}
```

(`client_id_metadata_document_supported` since phase 4; `iss` on every
authorization response since phase 2.) Protected
resource metadata: `{"resource": ".../mcp", "authorization_servers":
["https://app.danangblockchainhub.com"], "scopes_supported": ["bookings"],
"bearer_methods_supported": ["header"]}`. The `mcp` 401 becomes
`Bearer resource_metadata="https://app.danangblockchainhub.com/.well-known/oauth-protected-resource/mcp", scope="bookings"`
for every auth failure (missing, malformed, expired, revoked, wrong audience).

### 3. Authorization and consent flow

1. `GET /oauth/authorize` (function) validates before showing any UI:
   `response_type=code`, known `client_id`, `redirect_uri` exactly registered
   for that client (loopback: match ignoring port only), `code_challenge` with
   `code_challenge_method=S256` (plain or missing → error), `resource` equal to
   the canonical URL (absent → default to it), `scope` ⊆ supported, `state`
   echoed. Invalid client or redirect URI → plain error page, **never a
   redirect**. Other errors → redirect with `error`, `state`, `iss`.
2. On success it stores `oauthRequests/{random id}` (10 min TTL, params only)
   and 302s to `/oauth/consent?request=<id>`. The same response binds the
   request to the browser (`functions/oauth/browser.js`): it sets a random
   per-browser id in `__session` (`Max-Age=600; Path=/oauth; Secure; HttpOnly;
   SameSite=Lax`, reused if the browser already has one, so concurrent
   sign-ins in one browser share it) and stores only its SHA-256 as
   `browserHash` on the request. `__session` is the only cookie Firebase
   Hosting forwards to functions; every `oauth` response is
   `Cache-Control: private, no-store`.
3. The SPA consent page (`src/pages/oauth/Consent.jsx`, lazy route) sits
   **outside `ProtectedRoute`** and does its own sign-in check.
   `ProtectedRoute`'s `firstStopPath` sends email-pending members to
   `/{member|admin}/verify-email` and would drop the request id; changing it
   to carry a return path would touch every protected route for one page.
   Instead the consent page shows the verify-email blocker inline (with a
   resend link) and keeps the request id in its own URL; the server-side
   `requireUser` gate in step 5 is authoritative anyway. Signed-out members
   go to `` `/login?redirect=${encodeURIComponent(`/oauth/consent?request=${id}`)}` ``
   (always `encodeURIComponent`, so the inner `?`/`&` survive;
   `toSafeRedirectPath` accepts the decoded path). Email, Google and wallet
   sign-in all end in a Firebase session, so wallet members need nothing new.
4. Page POSTs `{action: "describe", request, idToken}` to
   `/oauth/consent-action` (same origin, Hosting rewrite to `oauth`, so the
   cookie arrives; a callable on `cloudfunctions.net` never sees it). The
   server checks the `Origin`, verifies the Firebase ID token, runs
   `requireUser`, then requires `SHA256(cookie) == browserHash`; otherwise
   403 `reason: browser` and the page says the link was opened in a different
   browser. On success → client name
   (marked as self-declared), redirect URI **hostname**, loopback warning,
   scope text, and the signed-in account (email or short wallet address).
5. Approve/Deny → the same endpoint with `action: "approve"|"deny"`.
   Server: the step 4 checks (Origin, ID token, `requireUser`, browser
   binding inside the transaction before any write, so a refused browser does
   not consume the request), then
   consumes the request in a transaction (single use), creates the grant and a
   code, returns the full redirect URL (`code`, `state`, `iss`). The SPA does
   `window.location.assign(url)`. JS navigation avoids the CSP `form-action
   'self'` limit that would block a form POST redirect to claude.ai.
6. `POST /oauth/token` (form-urlencoded) `authorization_code`: code consumed
   in a transaction, must match `client_id`, `redirect_uri`, `resource`, and
   `SHA256(code_verifier)`; code TTL 60 s. A wrong `client_id`,
   `redirect_uri` or `resource` leaves the code valid for a corrected retry; a
   failed PKCE check burns it (one verifier guess per code). Only a replay of a
   code that already issued tokens revokes the grant.

Always show consent (no silent re-approval): DCR clients are new per
connection anyway, and the page is the only phishing defense.

### 4. Client registration

- **DCR (phase 2, required: both Claude and ChatGPT fall back to it).**
  `POST /oauth/register` JSON. Public clients only
  (`token_endpoint_auth_method: "none"`, no secret issued). Redirect URIs must
  match the **allowlist**: the two Claude callbacks, the two ChatGPT forms
  (`connector_platform_oauth_redirect`, `connector/oauth/[A-Za-z0-9_-]{1,128}`), and
  loopback `http://localhost|127.0.0.1:<port>/callback` (also
  `/callback/[A-Za-z0-9_-]{1,128}`, Codex's per-server callback when an AS
  lacks RFC 9207 `iss` (#284), and `/oauth/callback` and
  `/oauth/callback/debug`, which MCP Inspector uses for the phase 3 check).
  Loopback matching ignores the port only: the path, including any
  `<id>`, must match exactly. Anything else →
  `invalid_redirect_uri` (decision 2). At most 5 redirect URIs of ≤ 256 chars
  each. `client_name` ≤ 64 chars with control, bidi and zero-width
  characters (plus Hangul fillers and the Braille blank, which render
  blank) stripped, stored as untrusted text. `grant_types` defaults to both
  `authorization_code` and `refresh_token` (Claude and ChatGPT omit it and
  need refresh), and `/oauth/token` answers `unauthorized_client` for a grant
  type the client did not register. **No per-IP limit for hosted clients**: Claude registers
  from Anthropic's shared egress (160.79.104.0/21) and makes a new client per
  fresh connection, and ChatGPT also registers from shared IPs, so a per-IP
  cap would lock out every member after a few connections. Instead:
  - Registrations whose redirect URIs are all known Claude/ChatGPT callbacks
    share a **global** cap of 500 per hour (well above member count; alerts
    in logs at 50 %), counted in `oauthRateLimits/dcr-hosted-<hour>`.
  - Registrations with a loopback redirect (Claude Code, local tools) are
    limited to 10 per IP per hour (`oauthRateLimits/dcr-ip-<ip hash>-<hour>`).
  - Unused clients expire: `expiresAt` is set to 1 day after registration and
    pushed to 30 days after each successful token exchange; Firestore TTL
    deletes the rest.
  - Ceiling: when more than 5,000 never-used clients exist (counter doc),
    registration returns `503` with `Retry-After` until TTL catches up.
- **CIMD (phase 4, `functions/oauth/cimd.js`).** A `client_id` that starts
  with `https://` is accepted at `/oauth/authorize` and `/oauth/token` only if
  it is exactly one of these strings (checked 2026-11-23, each document
  fetched and read):

  | URL | Client | Source |
  | --- | --- | --- |
  | `https://chatgpt.com/oauth/client.json` | ChatGPT, when the AS meets RFC 9207 | developers.openai.com/apps-sdk/build/auth ("Client ID Metadata Documents") |
  | `https://claude.ai/oauth/mcp-oauth-client-metadata` | Claude web, Desktop, mobile, Cowork | claude.com/docs/connectors/building/enterprise-managed-auth (names it as Claude's public CIMD; the authentication page says custom connectors use "the Client ID Metadata Document that Anthropic hosts") |
  | `https://claude.ai/oauth/claude-code-client-metadata` | Claude Code | claude.com/docs/connectors/building/authentication ("Callback URLs") |
  | `https://chatgpt.com/oauth/codex/client.json` | Codex CLI, IDE extension, ChatGPT desktop app (#284, added 2026-11-23) | developers.openai.com/codex/mcp ("Client ID Metadata Document URLs") and openai/codex `codex-rs/rmcp-client/src/oauth_client_registration.rs` |

  Not allowlisted: ChatGPT's per-callback `…/oauth/{callback_id}/client.json`
  and Codex's `…/oauth/codex/{callback_id}/client.json` (each only used when
  the AS lacks RFC 9207 `iss` or a metadata `issuer`, which this AS has) and
  Claude's `…/confidential_client` form (`private_key_jwt`, which this AS
  does not offer). Codex's document lists only loopback redirects
  (`http://127.0.0.1/callback`, `http://localhost/callback`, no port) and
  `none`, as Claude Code's does: this is native-app CIMD, so anyone can
  present that `client_id` with a callback on their own machine. That is
  the expected trust model (RFC 8252): the code only reaches a listener on
  the signing-in member's machine, PKCE binds it to the requester, and
  consent flags the loopback redirect. Only the allowlisted string itself is ever fetched, so a
  request cannot point the server at another URL (SSRF). Fetch: GET, 3 s
  timeout over the whole exchange, 16 KB cap (declared or streamed),
  `redirect: "manual"` with any non-200 refused, JSON content type, no
  cookies or credentials. Per function instance, the validated client is
  cached 1 h; concurrent fetches of one URL share a single request; an
  "unavailable" failure (403, 408, 429, 5xx, network, timeout: Cloudflare
  in front of both hosts may challenge or throttle Google Cloud egress) is
  remembered 30 s; and during such a failure the last validated document is
  served stale for up to 24 h past its expiry (logged as `oauth: CIMD
  serving stale client metadata`), at authorize, code exchange and refresh,
  so a blocked refetch does not end live grants. An "invalid" result (404,
  other 4xx, 3xx, non-JSON, oversize, failed validation) is never covered
  by stale and drops the cached document. Validation, all fail-closed:
  `client_id` equals the URL; `redirect_uris` 1–5 strings, all on the DCR
  allowlist (the requested `redirect_uri` must then match the document, with
  the loopback port ignored); `grant_types` must include
  `authorization_code` (unsupported types such as jwt-bearer are dropped,
  default `["authorization_code"]` per RFC 7591); `response_types` must
  include `code`; the client must allow `none` (`token_endpoint_auth_method:
  "none"` or `"none"` in `token_endpoint_auth_methods_supported`; ChatGPT
  prefers `private_key_jwt` but lists `none`, and uses `none` because this AS
  advertises only that); no `client_secret`; lists ≤ 10 entries and strings
  ≤ 256 chars; `client_name` cleaned like DCR. Unknown fields are ignored.
  Errors: an unknown or invalid client gets the plain error page (400) at
  authorize and 401 `invalid_client` at token; an unavailable document with
  no stale copy gets a 503 page at authorize and 503
  `temporarily_unavailable` (`Retry-After: 30`) at token, never a 500 or a
  redirect.
  Storage: CIMD clients have no `oauthClients` doc (no TTL, no DCR counters).
  `/oauth/authorize` stores `cimd: true` and the validated `clientName` on
  the request; consent shows that name (`clientNameSelfDeclared: false`,
  since it comes from an allowlisted host) and copies it onto the grant, so
  Connected apps lists the grant and Disconnect revokes it exactly as for
  DCR. Grants, codes and tokens carry the URL as `clientId`. DCR is
  unchanged and stays the fallback.
  Rollback: set `CIMD_ADVERTISED = false` in `functions/oauth/config.js`.
  The metadata then drops `client_id_metadata_document_supported`, so new
  Claude, ChatGPT and Codex connections register through DCR, while the
  allowlist still accepts the URLs and existing CIMD grants keep refreshing. Do not
  roll back by removing a URL from the allowlist: while CIMD is advertised
  the client keeps sending that URL (new sign-ins get a 400) and its
  existing grants fail at their next refresh.

### 5. Tokens

| Token | Format | Lifetime | Storage |
| --- | --- | --- | --- |
| Authorization code | 32 random bytes, hex | 60 s, single use | `oauthCodes/{sha256}` |
| Access | `dha_<64 hex>` opaque | 1 h | `oauthTokens/{sha256}` `{type, grantId, uid, aud, scope, expiresAt}` |
| Refresh | `dhr_<64 hex>` opaque | 30 days sliding, grant capped at 90 days (same as `dhm_`) | `oauthTokens/{sha256}` |

All new `expiresAt` fields are Firestore **Timestamps** (required for TTL
policies), unlike `mcpTokens`, which stores `expiresAt` as epoch ms and has no
TTL. Do not copy the `mcpTokens` pattern here.

Opaque, not JWT: the resource server and AS share Firestore, revocation is
immediate, and there is no signing key to manage. Only SHA-256 hashes are
stored. Refresh rotates on every use; a refresh token presented twice (reuse)
revokes the whole grant (OAuth 2.1 §4.3.1). Dead refresh → `invalid_grant`.
Refresh tokens are issued whether or not `offline_access` is requested
(ChatGPT may not ask). Expired docs are removed by a Firestore TTL policy on
`expiresAt`.

Audience binding: `aud` is set from the validated `resource`; `mcp` rejects
any `dha_` token whose `aud` is not its canonical URL (401). `mcp` never
forwards tokens anywhere (no passthrough).

### 6. Resource server changes (`mcp`)

`authenticate(header)` dispatches on prefix: `dhm_` → existing path unchanged;
`dha_` → hash lookup, `type == "access"`, not expired, `aud` matches, grant
not revoked, `requireUser(uid)`, then rate limit. A `dha_` principal is
`{uid, grantId}`. Phase 3 correction: booking transactions re-check the
credential, so `memberFor` in `mcpBookings.js` reads `oauthGrants/{grantId}`
for `dha_` principals (`mcpTokens/{hash}` for `dhm_`); tool behavior is
unchanged (owner-approved 2026-11-23). Rate limit: 60 req/min per grant, same
transactional counter as `mcpTokens` (stored on `oauthGrants/{id}`), plus
`lastUsedAt` (written at most once per minute).

Origin allowlist: unchanged. Claude and ChatGPT call `/mcp` server-to-server
without an `Origin` header; the check stays as DNS-rebinding protection. The
OAuth metadata, register, token and revoke endpoints send
`Access-Control-Allow-Origin: *` without credentials (public clients, no
cookies), so browser-based tools like MCP Inspector work. `/oauth/authorize`
is a top-level navigation and needs no CORS.

### 6a. PWA service worker

`public/sw.js` routes every navigation network-first with a 5 s fallback to
the precached `index.html`; only `/^\/__\//` is denylisted. `/oauth/authorize`
is a top-level navigation on the app origin, so with the PWA installed a cold
`oauth` function (>5 s) would get the SPA shell instead of the flow. Phase 1
extends the `NavigationRoute` denylist with `/^\/\.well-known\//` and
`/^\/oauth\/(?!consent(?:[/?#]|$))/`, so only `/oauth/consent` (a real SPA
route) stays on the shell fallback. `/mcp` is never a navigation (POST only).

### 7. Member controls

Profile → "Book with your AI agent" gains **Connected apps**: one row per
active grant (client name, redirect host, created, last used) with
**Disconnect**. `manageMcpToken` gains `listGrants` and `revokeGrant`
actions; revoking deletes the grant's tokens in a batch and marks the grant
revoked so in-flight access tokens fail on next use. The `dhm_` token section
stays as is. EN and VI strings.

### 8. Firestore

New server-only collections: `oauthClients`, `oauthRequests`, `oauthCodes`,
`oauthGrants`, `oauthTokens`, `oauthRateLimits`. `firestore.rules` has no
catch-all, so they are already denied; add explicit `allow read, write: if
false` blocks for documentation, and extend `test/firestore-mcp.rules.test.js`
to assert owner, other member, admin and signed-out contexts all fail. TTL
policies on `expiresAt` for requests, codes, tokens, clients (gcloud, one-time,
in the deploy runbook). README Firestore collections table updated.

## Threats and mitigations (summary)

- Phishing client posing as Claude: redirect allowlist + hostname on consent.
- Code interception: PKCE S256 required, 60 s single-use code; replaying an exchanged code revokes its grant, a failed PKCE check burns the code.
- Open redirect: no redirect before client + redirect URI validate.
- Token theft: hashed storage, 1 h access tokens, rotating refresh with reuse detection, revocation in Profile.
- Cross-resource token use: `aud` check; `dhm_` and `dha_` namespaces distinct.
- Clickjacking consent: existing `frame-ancestors 'self'`.
- DCR spam / Firestore cost: global cap for hosted callbacks, per-IP cap for loopback only, TTL expiry, unused-client ceiling, allowlist.
- CSRF on consent: approval needs the member's Firebase ID token in the POST body (a cross-site page cannot obtain it), the `Origin` must be `https://app.danangblockchainhub.com`, and the binding cookie is `SameSite=Lax`; the request is single use.
- Consent link forwarding (found in phase 3 review): an attacker starts a sign-in from their own connector (for example their ChatGPT callback, which the allowlist accepts) and sends the member the `/oauth/consent?request=<id>` link; approving would send the code and the attacker's `state` to the attacker's callback. Mitigation: the request is bound to the browser that hit `/oauth/authorize` (HttpOnly `__session` cookie, SHA-256 on the request), and describe, approve and deny from any other browser fail with 403 without consuming the request. Sign-in and email verification inside the same browser keep the cookie. Residual: someone who controls a `danangblockchainhub.com` subdomain could toss a cookie (a `__Host-` name would stop that, but Hosting forwards only `__session`); and a verification link opened in another browser (for example the phone's mail app) lands there, so the member returns to the original tab.

## Phased delivery (one PR each)

0. **This PR**: design + spec.
1. **Hosting origin**: `/mcp` rewrite; service worker denylist for `/oauth/*` (except consent) and `/.well-known/*`; Profile and docs show the new URL; `dhm_` works through Hosting. No OAuth advertised yet.
2. **AS backend, dark**: `functions/oauth/*` (metadata, register, authorize, token, revoke), rules + tests, unit tests for PKCE, redirect matching, rotation/reuse. Well-known rewrites deployed, but all three metadata paths (`/.well-known/oauth-protected-resource`, `.../oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server`) return 404 (`DISCOVERY_ENABLED = false` in `functions/oauth/config.js`) and `mcp` 401 does not point at them: a client that found the protected-resource document, or fell back to the origin's AS metadata (MCP 2025-03-26), would start a sign-in that dead-ends on the missing consent page. Without the rewrites the SPA catch-all would answer 200 HTML.
3. **Switch on**: `DISCOVERY_ENABLED = true`, consent page with browser binding (`/oauth/consent-action` on `oauth`; the `oauthConsent` callable is retired to a stub), `dha_` acceptance + `resource_metadata` 401 in `mcp`, Connected apps UI, docs (Claude web/Desktop and ChatGPT rows become "Sign in"). To verify right after deploy (the browser-bound consent path cannot run on preview channels or emulators, whose origin `/oauth/consent-action` refuses): Claude web, Claude Desktop, Claude Code and MCP Inspector via its proxy (Inspector's direct browser mode sends an `Origin` that `/mcp` rejects with 403). If consent fails for everyone, set `DISCOVERY_ENABLED = false` to switch sign-in back off.
4. **CIMD allowlist + ChatGPT verification** (`iss`, stable redirect):
   `functions/oauth/cimd.js`, `client_id_metadata_document_supported: true`
   behind the `CIMD_ADVERTISED` switch.
   RFC 9207 `iss` (success, error and deny redirects) and the
   `connector_platform_oauth_redirect` allowlist entry already shipped in
   phase 2; phase 4 adds tests for both. Post-deploy: connect ChatGPT, and
   check that Claude web now uses CIMD (Claude switches from DCR once the
   metadata advertises CIMD; existing DCR grants keep working).

## Decisions (2026-11-22, all recommendations accepted by the repo owner)

1. **OAuth origin**: only at `https://app.danangblockchainhub.com/mcp`. The raw `cloudfunctions.net/mcp` URL stays `dhm_`-only and never advertises `resource_metadata`.
2. **Redirect URIs**: allowlist only the Claude and ChatGPT callbacks and loopback (`localhost`/`127.0.0.1`). Other HTTPS redirect URIs are rejected at registration.
3. **Lifetimes**: access token 1 h; refresh token 30 days sliding; grant hard cap 90 days, after which the member consents again (same as `dhm_`).
4. **Who may connect**: the same gate as `dhm_`: `requireUser` (not disabled; email verified only when the account has an email). No server-side profile-complete check, no role exclusions.
5. **Cold start**: accept cold starts. Keep the `oauth` function's requires lazy and measure the token endpoint in phase 2; revisit `minInstances: 1` only if it misses Claude's 10 s budget.
6. **Scopes**: one `bookings` scope covering every MCP tool, including `list_upcoming_events` (#299).
7. **Rate limit**: 60 requests/min per grant, like per `dhm_` token.
8. **Directory listing**: not a goal for now; phases 1 to 4 stay as designed.
