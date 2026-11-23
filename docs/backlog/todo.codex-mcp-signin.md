# Codex MCP sign-in (CIMD allowlist + `/callback/<id>` loopback)
**Phase**: — · **Deps**: mcp-oauth

## Goal
Fix #284: Codex (CLI, IDE extension, ChatGPT desktop app) signs in to the Hub MCP server with its default `auto` registration, which picks CIMD and sends `https://chatgpt.com/oauth/codex/client.json` as `client_id`; we refuse it today because it is not on the exact allowlist. Also accept Codex's per-server loopback callback form `/callback/<callback_id>` so a DCR or future CIMD path using it is not refused.

## Files
- `functions/oauth/cimd.js` (edited) — add `https://chatgpt.com/oauth/codex/client.json` to `ALLOWLIST` with a source comment.
- `functions/oauth/util.js` (edited) — `LOOPBACK` also allows `/callback/<id>`, `<id>` = `[A-Za-z0-9_-]{1,128}`.
- `test/mcpOauth.test.js` (edited) — loopback `/callback/<id>` accept/reject/match tests; Codex CIMD end to end with a stubbed document shaped like the real one.
- `docs/knowledge/mcp-booking.md` (edited) — Codex setup section.
- `docs/knowledge/mcp-oauth-design.md` (edited) — Codex row in the CIMD allowlist table; loopback forms.
- `README.md` (edited) — feature list and `oauth` function row name Codex and four CIMD URLs.

## Acceptance
- [ ] `cimd.ALLOWLIST` is exactly ChatGPT, Claude, Claude Code and Codex.
- [ ] Codex's document as served on 2026-11-23 validates (`client_id` = URL, `none`, loopback redirect URIs).
- [ ] Codex CIMD completes authorize, consent and token on `http://127.0.0.1:<random port>/callback`.
- [ ] Codex CIMD also completes on `http://localhost:<port>/callback`.
- [ ] A redirect Codex's document does not list (e.g. `/oauth/callback`) is refused with 400 and no redirect.
- [ ] `http://127.0.0.1:<port>/callback/<id>` and `http://localhost/callback/<id>` are allowed redirects.
- [ ] `/callback/`, `/callback/a/b`, a 129-char id, `/callback/..`, `/callback/a%2Fb` and `/callbackX` are refused.
- [ ] Matching `/callback/<id>` ignores the port but requires the exact id.
- [ ] The 256-char redirect cap and 5-URI cap still apply to `/callback/<id>` URIs.
- [ ] NOT: a pattern allowlist for `https://chatgpt.com/oauth/codex/<callback_id>/client.json` (Codex uses the stable URL because we advertise RFC 9207 `iss` and an `issuer`).
- [ ] NOT: changes to `firestore.rules`, `functions/mcpBookings.js` or the Cloud Functions list.

## Verify
- `npm test` → all pass, including the new Codex and `/callback/<id>` tests.
- `npm run lint && npm run build` → green.
- `cd functions && npm run lint` → green.
- `npm run test:rules` → green (no rules change; regression only).
- mutation: revert the `LOOPBACK` change → a `/callback/<id>` test fails.
- post-deploy: `codex mcp add hub --url https://app.danangblockchainhub.com/mcp` then `codex mcp login hub` with default settings completes; `list_amenities` works; no `oauth: CIMD client refused` for the Codex URL in `firebase functions:log`.
- regression: Claude, Claude Code and ChatGPT CIMD tests still pass.

## Notes
- Source: Codex docs (learn.chatgpt.com/docs/extend/mcp?surface=cli) and `codex-rs/rmcp-client/src/oauth_client_registration.rs` in openai/codex: the stable URL is used when the AS advertises `authorization_response_iss_parameter_supported: true` and an `issuer`, which ours does; otherwise Codex uses `https://chatgpt.com/oauth/codex/<callback_id>/client.json` with `/callback/<callback_id>`.
- Loopback CIMD is native-app CIMD: anyone can present the Codex `client_id` with a local callback, same as Claude Code today. The consent page already flags loopback redirects; the code only reaches the member's own machine.
