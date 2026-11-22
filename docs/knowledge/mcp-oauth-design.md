# MCP OAuth sign-in: design

Issue #263 · spec `docs/backlog/todo.mcp-oauth.md` · status: proposed, not built.

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
| Registration | CIMD SHOULD, DCR MAY | CIMD only if `client_id_metadata_document_supported: true` **and** `none` in `token_endpoint_auth_methods_supported`, else DCR (new client per fresh connection) | Prefers CIMD (`https://chatgpt.com/oauth/client.json`), else DCR (once per connection) |
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

The consent UI is the SPA route `/oauth/consent` (served by the catch-all).
Why not the raw `cloudfunctions.net/mcp` URL: its origin cannot serve
`/.well-known/*`, and a branded URL survives a future region move. The raw URL
keeps working for `dhm_` tokens; its 401 points at metadata whose `resource`
is the raw URL only if we decide to support OAuth there too (open question 1).
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

(`client_id_metadata_document_supported` only from phase 4.) Protected
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
   and 302s to `/oauth/consent?request=<id>`.
3. The SPA consent page (`src/pages/oauth/Consent.jsx`, lazy route, not
   behind `requireProfileComplete` so the redirect isn't lost; it shows the
   profile/email-verification blocker inline). Signed-out members go to
   `/login?redirect=/oauth/consent?request=…` (already validated by
   `toSafeRedirectPath`); email, Google and wallet sign-in all end in a
   Firebase session, so wallet members need nothing new.
4. Page calls callable `oauthConsent` `{action: "describe"}` → client name
   (marked as self-declared), redirect URI **hostname**, loopback warning,
   scope text, and the signed-in account (email or short wallet address).
5. Approve/Deny → `oauthConsent {action: "approve"|"deny", request}`.
   Server: `requireUser(uid)` (disabled, email-verification gates as today),
   consumes the request in a transaction (single use), creates the grant and a
   code, returns the full redirect URL (`code`, `state`, `iss`). The SPA does
   `window.location.assign(url)`. JS navigation avoids the CSP `form-action
   'self'` limit that would block a form POST redirect to claude.ai.
6. `POST /oauth/token` (form-urlencoded) `authorization_code`: code consumed
   in a transaction, must match `client_id`, `redirect_uri`, `resource`, and
   `SHA256(code_verifier)`; code TTL 60 s; a reused code revokes the grant.

Always show consent (no silent re-approval): DCR clients are new per
connection anyway, and the page is the only phishing defense.

### 4. Client registration

- **DCR (phase 2, required: both Claude and ChatGPT fall back to it).**
  `POST /oauth/register` JSON. Public clients only
  (`token_endpoint_auth_method: "none"`, no secret issued). Redirect URIs must
  match the **allowlist**: the two Claude callbacks, the two ChatGPT forms
  (`connector_platform_oauth_redirect`, `connector/oauth/[A-Za-z0-9_-]+`), and
  loopback `http://localhost|127.0.0.1:<port>/callback`. Anything else →
  `invalid_redirect_uri` (open question 2). `client_name` ≤ 64 chars, stored
  as untrusted text. Rate limit 10 registrations / IP / hour; clients unused
  for 30 days expire via Firestore TTL.
- **CIMD (phase 4).** Accept URL `client_id`s only from an allowlist
  (`https://chatgpt.com/oauth/client.json`,
  `https://claude.ai/oauth/claude-code-client-metadata`, plus Claude's hosted
  CIMD URL once confirmed). Allowlisting removes the SSRF risk of fetching
  arbitrary URLs; fetch with 3 s timeout, 16 KB cap, no redirects, cache 1 h,
  require `client_id` == URL and redirect URIs ⊆ the DCR allowlist.

### 5. Tokens

| Token | Format | Lifetime | Storage |
| --- | --- | --- | --- |
| Authorization code | 32 random bytes, hex | 60 s, single use | `oauthCodes/{sha256}` |
| Access | `dha_<64 hex>` opaque | 1 h | `oauthTokens/{sha256}` `{type, grantId, uid, aud, scope, expiresAt}` |
| Refresh | `dhr_<64 hex>` opaque | 30 days sliding, grant capped at 90 days (same as `dhm_`) | `oauthTokens/{sha256}` |

Opaque, not JWT: the resource server and AS share Firestore, revocation is
immediate, and there is no signing key to manage. Only SHA-256 hashes are
stored. Refresh rotates on every use; a refresh token presented twice (reuse)
revokes the whole grant (OAuth 2.1 §4.3.1). Dead refresh → `invalid_grant`.
Refresh tokens are issued whether or not `offline_access` is requested
(ChatGPT may not ask). Expired docs are removed by a Firestore TTL policy on
`expiresAt` (Timestamp field).

Audience binding: `aud` is set from the validated `resource`; `mcp` rejects
any `dha_` token whose `aud` is not its canonical URL (401). `mcp` never
forwards tokens anywhere (no passthrough).

### 6. Resource server changes (`mcp`)

`authenticate(header)` dispatches on prefix: `dhm_` → existing path unchanged;
`dha_` → hash lookup, `type == "access"`, not expired, `aud` matches, grant
not revoked, `requireUser(uid)`, then rate limit. Principal stays `{uid}`, so
`mcpBookings.js` is untouched. Rate limit: 60 req/min per grant, same
transactional counter as `mcpTokens` (stored on `oauthGrants/{id}`), plus
`lastUsedAt` (written at most once per minute).

Origin allowlist: unchanged. Claude and ChatGPT call `/mcp` server-to-server
without an `Origin` header; the check stays as DNS-rebinding protection. The
OAuth metadata, register, token and revoke endpoints send
`Access-Control-Allow-Origin: *` without credentials (public clients, no
cookies), so browser-based tools like MCP Inspector work. `/oauth/authorize`
is a top-level navigation and needs no CORS.

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
- Code interception: PKCE S256 required, 60 s single-use code, reuse revokes grant.
- Open redirect: no redirect before client + redirect URI validate.
- Token theft: hashed storage, 1 h access tokens, rotating refresh with reuse detection, revocation in Profile.
- Cross-resource token use: `aud` check; `dhm_` and `dha_` namespaces distinct.
- Clickjacking consent: existing `frame-ancestors 'self'`.
- DCR spam / Firestore cost: IP rate limit, TTL expiry, allowlist.
- CSRF on consent: approval only through a Firebase-authenticated callable bound to the stored request id; request is single use.

## Phased delivery (one PR each)

0. **This PR**: design + spec.
1. **Hosting origin**: `/mcp` rewrite; Profile and docs show the new URL; `dhm_` works through Hosting. No OAuth advertised yet.
2. **AS backend, dark**: `functions/oauth/*` (metadata, register, authorize, token, revoke), rules + tests, unit tests for PKCE, redirect matching, rotation/reuse. Well-known rewrites deployed but `mcp` 401 not yet pointing at them.
3. **Switch on**: consent page, `oauthConsent` callable, `dha_` acceptance + `resource_metadata` 401 in `mcp`, Connected apps UI, docs (Claude web/Desktop and ChatGPT rows become "Sign in"). Verified end to end with Claude web, Claude Desktop, Claude Code and MCP Inspector.
4. **CIMD allowlist + ChatGPT verification** (`iss`, stable redirect).

## Open questions for a human

1. **Raw function URL and OAuth**: OAuth only at `app.danangblockchainhub.com/mcp` (recommended; raw URL stays `dhm_`-only), or also advertise OAuth on the raw URL?
2. **Redirect URI policy**: allowlist only Claude, ChatGPT and loopback (recommended), or open DCR to any HTTPS redirect URI so other MCP clients (Cursor, VS Code, etc.) work, at a phishing cost?
3. **Lifetimes**: access 1 h, refresh 30 days sliding, grant hard cap 90 days (re-consent quarterly, matching `dhm_`)? Or no hard cap?
4. **Who may connect**: same gate as `dhm_` (any member with complete profile and verified email), or members only / admins excluded?
5. **Cold start**: the token endpoint has a 10 s budget in Claude. Accept cold starts (lean function, measured in phase 2), or pay for `minInstances: 1` on `oauth`?
6. **Scopes**: one `bookings` scope (recommended, matches today's six tools), or split `bookings:read` / `bookings:write` now?
7. **Rate limit scope**: per grant (recommended, like per `dhm_` token) or one shared 60/min budget per member across all clients?
8. **Directory listing**: is a public Claude directory / ChatGPT app store listing a goal? It changes nothing in phases 1 to 4 but would add review requirements.
