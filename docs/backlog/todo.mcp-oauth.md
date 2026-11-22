# MCP OAuth sign-in for Claude and ChatGPT connectors
**Phase**: — · **Deps**: mcp-booking-server, mcp-server-instructions-257

## Goal
Resolve #263: let members connect Claude web/Desktop/mobile custom connectors and ChatGPT apps to the Hub MCP server by signing in with their Hub account (OAuth 2.1 per MCP authorization 2025-11-25), with no pasted token. Personal `dhm_` tokens keep working unchanged. Design: `docs/knowledge/mcp-oauth-design.md`.

## Files
- `docs/knowledge/mcp-oauth-design.md` (new) — architecture, client requirements, threats, phases, decisions.
- `public/sw.js` (edited, phase 1) — `NavigationRoute` denylist adds `/.well-known/` and `/oauth/` except `/oauth/consent`.
- `firebase.json` (edited) — Hosting rewrites for `/mcp`, `/.well-known/oauth-*`, `/oauth/*` before the SPA catch-all.
- `functions/oauth/` (new, phase 2) — `config`, `util`, `register`, `authorize`, `token` (token, revoke, access-token validation), `consent` (`oauthConsent` logic), `http` (router).
- `functions/index.js` (edited) — export `oauth` and `oauthConsent`; `mcp` 401 adds `resource_metadata` and `scope`.
- `functions/mcpTokens.js` (edited) — accept `dha_` access tokens with audience check; `listGrants`/`revokeGrant` actions.
- `src/pages/oauth/Consent.jsx`, `src/App.jsx`, `src/services/mcpTokens.js` (new/edited) — consent route and service calls.
- `src/components/McpTokens.jsx` (edited) — Connected apps list with Disconnect.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — consent and connected-apps strings.
- `firestore.rules`, `test/firestore-mcp.rules.test.js` (edited) — deny-all for `oauthClients`, `oauthRequests`, `oauthCodes`, `oauthGrants`, `oauthTokens`, `oauthRateLimits`.
- `test/mcpOauth.test.js` (new, phase 2) — PKCE, redirect matching, DCR limits, code single use, refresh rotation and reuse, audience.
- `src/utils/navigationDenylist.js`, `test/navigationDenylist.test.js` (new, phase 2) — service worker denylist as an importable, tested module.
- `docs/knowledge/mcp-booking.md`, `README.md` (edited) — new URL, sign-in setup, functions and collections tables.

## Acceptance
- [ ] Unauthenticated `POST /mcp` returns 401 with `WWW-Authenticate` carrying `resource_metadata` and `scope="bookings"`.
- [x] `/.well-known/oauth-protected-resource/mcp` returns `resource` equal to `https://app.danangblockchainhub.com/mcp`.
- [x] AS metadata lists `code_challenge_methods_supported: ["S256"]` and `token_endpoint_auth_methods_supported: ["none"]`.
- [x] DCR rejects a redirect URI outside the allowlist with `invalid_redirect_uri`.
- [x] DCR for Claude/ChatGPT callbacks is not limited per IP, only by a global hourly cap.
- [x] DCR with a loopback redirect is limited to 10 per IP per hour.
- [ ] Unused clients expire by TTL, and registration returns 503 above the unused-client ceiling.
- [ ] With the PWA installed, a navigation to `/oauth/authorize` or `/.well-known/*` never gets the cached SPA shell.
- [ ] A signed-out or email-pending member returns to the same consent request after login or verification.
- [x] `/oauth/authorize` with an unregistered redirect URI shows an error page and does not redirect.
- [x] `/oauth/authorize` without S256 PKCE is rejected.
- [ ] Consent page shows the redirect hostname and a warning for loopback redirects.
- [ ] A wallet-signed-in member can approve consent.
- [x] Authorization codes expire after 60 s and work once.
- [x] Refresh rotates the token, and a reused refresh token revokes the grant.
- [ ] An access token whose `aud` is not the canonical MCP URL gets 401.
- [ ] Disconnect in Profile makes that grant's next MCP request return 401.
- [x] A `dhm_` token works at both the raw function URL and `/mcp` on Hosting.
- [x] Clients cannot read or write any `oauth*` collection.
- [ ] Claude web and Claude Desktop connect via sign-in with no request header.
- [x] NOT: store raw codes or tokens.
- [x] NOT: support `plain` PKCE, implicit, password or `client_credentials` grants.
- [ ] NOT: change MCP tool behavior or `mcpBookings.js`.

## Verify
- `npm run lint && npm run build && npm --prefix functions run lint && npm test` → green.
- `npm run test:rules` → `oauth*` deny-all cases pass.
- `curl -si -X POST https://app.danangblockchainhub.com/mcp` → 401 with `resource_metadata`.
- MCP Inspector via its proxy (`npx @modelcontextprotocol/inspector`, proxy transport; direct browser mode sends an `Origin` that `/mcp` rejects with 403) against the Hosting URL → OAuth flow completes, `list_amenities` works.
- Installed PWA, cold `oauth` function: open an `/oauth/authorize` link → function response, not the SPA shell.
- Claude web: Customize → Connectors → Add custom connector with the Hosting URL → sign-in, consent, tools listed.
- regression: Claude Code with `dhm_` header still lists amenities; Profile token generate/revoke still works.

## Notes
- Delivered in the phases listed in the design doc, one PR each; each PR ticks its bullets here, and the final PR renames this spec.
- Open questions were decided on 2026-11-22 (all recommendations); see Decisions in the design doc.
- Hosting rewrite order matters: specific rewrites before `**`.
- Consent route is outside `ProtectedRoute`; build `/login?redirect=` with `encodeURIComponent`.
- New `expiresAt` fields are Timestamps (TTL), not epoch ms like `mcpTokens`.
