# MCP OAuth sign-in for Claude and ChatGPT connectors
**Phase**: — · **Deps**: mcp-booking-server, mcp-server-instructions-257

## Goal
Resolve #263: let members connect Claude web/Desktop/mobile custom connectors and ChatGPT apps to the Hub MCP server by signing in with their Hub account (OAuth 2.1 per MCP authorization 2025-11-25), with no pasted token. Personal `dhm_` tokens keep working unchanged. Design: `docs/knowledge/mcp-oauth-design.md`.

## Files
- `docs/knowledge/mcp-oauth-design.md` (new) — architecture, client requirements, threats, phases, decisions.
- `public/sw.js` (edited, phase 1), `firebase.json` (edited) — service worker denylist adds `/.well-known/` and `/oauth/` except `/oauth/consent`; Hosting rewrites for `/mcp`, `/.well-known/oauth-*`, `/oauth/*` before the SPA catch-all.
- `functions/oauth/` (new) — phase 2: `config`, `util`, `register`, `authorize`, `token` (token, revoke, access-token validation), `consent` (logic and the `POST /oauth/consent-action` handler), `http` (router); phase 3: `browser` (consent binding: `__session` cookie from `/oauth/authorize`, SHA-256 on the request, checked on describe/approve/deny), `resource` (Hosting-vs-raw via `X-Forwarded-Host`, the 401 challenge; used by `functions/mcpServer.js`).
- `functions/oauth/cimd.js` (new, phase 4) — CIMD: exact `client_id` URL allowlist, capped no-redirect fetch, validation, 1 h cache; `authorize`, `token`, `consent`, `http`, `config`, `register` resolve either client form and advertise `client_id_metadata_document_supported`.
- `functions/index.js` (edited) — export `oauth` (also serving `/oauth/consent-action`) and a retired `oauthConsent` stub that approves nothing; `mcp` 401 adds `resource_metadata` and `scope`.
- `functions/mcpBookings.js` (edited, phase 3) — `memberFor` re-checks `oauthGrants/{grantId}` for `dha_` principals inside each booking transaction; tool behavior unchanged.
- `functions/mcpTokens.js` (edited) — accept `dha_` access tokens with audience check; `listGrants`/`revokeGrant` actions.
- `src/pages/oauth/Consent.jsx`, `Consent.css`, `src/App.jsx`, `src/services/mcpTokens.js`, `src/utils/oauthConsent.js`, `src/hooks/useSendVerificationLink.js` (new/edited), `src/pages/member/VerifyEmail.jsx` (edited) — consent route, helpers, service calls and the shared verification-link hook.
- `src/components/McpTokens.jsx`, `McpTokens.css` (edited), `src/components/ConnectedApps.jsx` (new), `src/locales/en.json`, `src/locales/vi.json` (edited) — Connected apps list with Disconnect (native `<dialog>` via `Modal`); consent and connected-apps strings.
- `test/oauthConsent.test.js` (new, phase 3), `src/utils/navigationDenylist.js`, `test/navigationDenylist.test.js` (new, phase 2) — consent redirect round trip and error mapping; service worker denylist as a tested module.
- `firestore.rules`, `test/firestore-mcp.rules.test.js` (edited) — deny-all for `oauthClients`, `oauthRequests`, `oauthCodes`, `oauthGrants`, `oauthTokens`, `oauthRateLimits`.
- `test/mcpOauth.test.js` (new, phase 2) — PKCE, redirect matching, DCR limits, code single use, refresh rotation and reuse, audience; phase 4 adds CIMD (stubbed fetch), RFC 9207 `iss` and the ChatGPT stable redirect.
- `docs/knowledge/mcp-booking.md`, `README.md` (edited) — new URL, sign-in setup, functions and collections tables.

## Acceptance
- [x] Unauthenticated `POST /mcp` returns 401 with `WWW-Authenticate` carrying `resource_metadata` and `scope="bookings"`.
- [x] `/.well-known/oauth-protected-resource/mcp` returns `resource` equal to `https://app.danangblockchainhub.com/mcp` (phase 3; phase 2 returns 404 while `DISCOVERY_ENABLED` is false, unit-tested with it on).
- [x] Until phase 3, all three `/.well-known/oauth-*` paths (protected-resource at the root and at `/mcp`, authorization-server) return JSON 404, not the SPA shell.
- [x] AS metadata lists `code_challenge_methods_supported: ["S256"]` and `token_endpoint_auth_methods_supported: ["none"]`.
- [x] DCR rejects a redirect URI outside the allowlist with `invalid_redirect_uri`.
- [x] DCR for Claude/ChatGPT callbacks is not limited per IP, only by a global hourly cap.
- [x] DCR with a loopback redirect is limited to 10 per IP per hour.
- [ ] Unused clients expire by TTL, and registration returns 503 above the unused-client ceiling.
- [ ] With the PWA installed, a navigation to `/oauth/authorize` or `/.well-known/*` never gets the cached SPA shell.
- [x] A signed-out or email-pending member returns to the same consent request after login or verification.
- [x] `/oauth/authorize` with an unregistered redirect URI shows an error page and does not redirect.
- [x] `/oauth/authorize` without S256 PKCE is rejected.
- [x] Consent page shows the redirect hostname and a warning for loopback redirects.
- [x] A wallet-signed-in member can approve consent.
- [x] Consent describe, approve and deny are refused (403 `reason: browser`) from a browser without the `/oauth/authorize` binding cookie, without consuming the request.
- [x] Authorization codes expire after 60 s and work once.
- [x] A code exchange rejected for a wrong `client_id`, `redirect_uri` or `resource` can be retried; a failed PKCE check burns the code; only a replay of a successfully exchanged code revokes the grant.
- [x] DCR strips control, bidi, zero-width and blank-rendering (Hangul filler, Braille blank) characters from `client_name` and caps each redirect URI at 256 chars.
- [x] The token endpoint rejects a grant type the client did not register with `unauthorized_client`; registration defaults to both grants.
- [x] Refresh rotates the token, and a reused refresh token revokes the grant.
- [x] An access token whose `aud` is not the canonical MCP URL gets 401.
- [x] Disconnect in Profile makes that grant's next MCP request return 401.
- [x] A `dhm_` token works at both the raw function URL and `/mcp` on Hosting.
- [x] Clients cannot read or write any `oauth*` collection.
- [ ] Claude web and Claude Desktop connect via sign-in with no request header.
- [x] AS metadata advertises `client_id_metadata_document_supported: true` and `authorization_response_iss_parameter_supported: true`.
- [x] A URL `client_id` is accepted at authorize and token only when it exactly equals an allowlisted CIMD URL.
- [x] A URL `client_id` off the allowlist is refused without any fetch.
- [x] A CIMD document whose `client_id` differs from its URL is refused.
- [x] A CIMD document with a redirect URI outside the DCR allowlist is refused.
- [x] A CIMD fetch that redirects, times out (3 s), exceeds 16 KB or returns non-JSON fails closed with an OAuth error, not a 500.
- [x] A validated CIMD document is reused from cache for 1 h; failures are not cached.
- [x] An allowlisted CIMD client completes authorize, consent and token, and its grant shows in Connected apps and can be disconnected.
- [x] Every authorization redirect (success, error and deny) carries `iss` equal to the issuer.
- [x] `https://chatgpt.com/connector_platform_oauth_redirect` is accepted for DCR and CIMD.
- [ ] ChatGPT connects via sign-in on the stable redirect.
- [x] NOT: store raw codes or tokens.
- [x] NOT: support `plain` PKCE, implicit, password or `client_credentials` grants.
- [x] NOT: fetch any URL that is not an exact allowlist entry, or follow redirects.
- [x] NOT: change MCP tool behavior; in `mcpBookings.js` only `memberFor`'s access check changes (owner-approved 2026-11-23).

## Verify
- `npm run lint && npm run build && npm --prefix functions run lint && npm test && npm run test:rules` → green, including the `oauth*` deny-all rules cases.
- `curl -si -X POST https://app.danangblockchainhub.com/mcp` → 401 with `resource_metadata`; `curl -s https://app.danangblockchainhub.com/.well-known/oauth-authorization-server` → `client_id_metadata_document_supported` and `authorization_response_iss_parameter_supported` both true.
- MCP Inspector via its proxy (`npx @modelcontextprotocol/inspector`, proxy transport; direct browser mode sends an `Origin` that `/mcp` rejects with 403) against the Hosting URL → OAuth flow completes, `list_amenities` works.
- Installed PWA, cold `oauth` function: open an `/oauth/authorize` link → function response, not the SPA shell.
- Claude web: Customize → Connectors → Add custom connector with the Hosting URL → sign-in, consent, tools listed.
- ChatGPT: add the Hosting URL as a custom MCP app with OAuth → consent shows ChatGPT and `chatgpt.com` → tools listed.
- regression: Claude Code with `dhm_` header still lists amenities; Profile token generate/revoke still works.

## Notes
- Delivered in the phases listed in the design doc, one PR each; each PR ticks its bullets here, and the final PR renames this spec.
- Hosting rewrite order matters: specific rewrites before `**`.
- Consent route is outside `ProtectedRoute`; build `/login?redirect=` with `encodeURIComponent`.
- New `expiresAt` fields are Timestamps (TTL), not epoch ms like `mcpTokens`.
- Phase 4: CIMD clients have no `oauthClients` doc; authorize stores `cimd: true` and the validated name on the request, consent copies it to the grant. Once CIMD is advertised, Claude web switches from DCR to its hosted CIMD URL for new connections; existing DCR grants keep working.
- Phase 3 review: consent moved from the `oauthConsent` callable to `POST /oauth/consent-action` on `oauth`, because only a Hosting rewrite forwards the `__session` binding cookie. The callable stays exported as a stub so the deploy does not try to delete a live function; drop it after `firebase functions:delete oauthConsent`.
