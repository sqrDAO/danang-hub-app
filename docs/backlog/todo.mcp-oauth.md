# MCP OAuth sign-in for Claude and ChatGPT connectors
**Phase**: — · **Deps**: mcp-booking-server, mcp-server-instructions-257

## Goal
Resolve #263: let members connect Claude web/Desktop/mobile custom connectors and ChatGPT apps to the Hub MCP server by signing in with their Hub account (OAuth 2.1 per MCP authorization 2025-11-25), with no pasted token. Personal `dhm_` tokens keep working unchanged. Design: `docs/knowledge/mcp-oauth-design.md`.

## Files
- `docs/knowledge/mcp-oauth-design.md` (new) — architecture, client requirements, threats, phases, open questions.
- `firebase.json` (edited) — Hosting rewrites for `/mcp`, `/.well-known/oauth-*`, `/oauth/*` before the SPA catch-all.
- `functions/oauth/` (new) — metadata, `register`, `authorize`, `token`, `revoke`, `oauthConsent` callable logic.
- `functions/index.js` (edited) — export `oauth` and `oauthConsent`; `mcp` 401 adds `resource_metadata` and `scope`.
- `functions/mcpTokens.js` (edited) — accept `dha_` access tokens with audience check; `listGrants`/`revokeGrant` actions.
- `src/pages/oauth/Consent.jsx`, `src/App.jsx`, `src/services/mcpTokens.js` (new/edited) — consent route and service calls.
- `src/components/McpTokens.jsx` (edited) — Connected apps list with Disconnect.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — consent and connected-apps strings.
- `firestore.rules`, `test/firestore-mcp.rules.test.js` (edited) — deny-all for `oauthClients`, `oauthRequests`, `oauthCodes`, `oauthGrants`, `oauthTokens`, `oauthRateLimits`.
- `test/mcpOauth.test.js` (new) — PKCE, redirect matching, code single use, refresh rotation and reuse, audience.
- `docs/knowledge/mcp-booking.md`, `README.md` (edited) — new URL, sign-in setup, functions and collections tables.

## Acceptance
- [ ] Unauthenticated `POST /mcp` returns 401 with `WWW-Authenticate` carrying `resource_metadata` and `scope="bookings"`.
- [ ] `/.well-known/oauth-protected-resource/mcp` returns `resource` equal to `https://app.danangblockchainhub.com/mcp`.
- [ ] AS metadata lists `code_challenge_methods_supported: ["S256"]` and `token_endpoint_auth_methods_supported: ["none"]`.
- [ ] DCR rejects a redirect URI outside the allowlist with `invalid_redirect_uri`.
- [ ] `/oauth/authorize` with an unregistered redirect URI shows an error page and does not redirect.
- [ ] `/oauth/authorize` without S256 PKCE is rejected.
- [ ] Consent page shows the redirect hostname and a warning for loopback redirects.
- [ ] A wallet-signed-in member can approve consent.
- [ ] Authorization codes expire after 60 s and work once.
- [ ] Refresh rotates the token, and a reused refresh token revokes the grant.
- [ ] An access token whose `aud` is not the canonical MCP URL gets 401.
- [ ] Disconnect in Profile makes that grant's next MCP request return 401.
- [ ] A `dhm_` token works at both the raw function URL and `/mcp` on Hosting.
- [ ] Clients cannot read or write any `oauth*` collection.
- [ ] Claude web and Claude Desktop connect via sign-in with no request header.
- [ ] NOT: store raw codes or tokens.
- [ ] NOT: support `plain` PKCE, implicit, password or `client_credentials` grants.
- [ ] NOT: change MCP tool behavior or `mcpBookings.js`.

## Verify
- `npm run lint && npm run build && npm --prefix functions run lint && npm test` → green.
- `npm run test:rules` → `oauth*` deny-all cases pass.
- `curl -si -X POST https://app.danangblockchainhub.com/mcp` → 401 with `resource_metadata`.
- `npx @modelcontextprotocol/inspector` against the Hosting URL → OAuth flow completes, `list_amenities` works.
- Claude web: Customize → Connectors → Add custom connector with the Hosting URL → sign-in, consent, tools listed.
- regression: Claude Code with `dhm_` header still lists amenities; Profile token generate/revoke still works.

## Notes
- Delivered in the phases listed in the design doc, one PR each; each PR ticks its bullets here, and the final PR renames this spec.
- Open questions in the design doc need a human answer before phase 2.
- Hosting rewrite order matters: specific rewrites before `**`.
