# Document the working Claude Desktop MCP path
**Phase**: — · **Deps**: —

## Goal
The MCP guide presents Claude's remote connector with a request header as working, but every connector request gets 401 ([#261](https://github.com/sqrDAO/danang-hub-app/issues/261)). Mark that path as not working (OAuth tracked in #263) and document the local `mcp-remote` bridge that works for Claude Desktop.

## Files
- `docs/knowledge/mcp-booking.md` (edited) — client table, Claude web, Claude Desktop and ChatGPT sections
- `docs/backlog/todo.mcp-connector-docs.md` (new) — this spec

## Acceptance
- [ ] The client table marks Claude web as having no working path and links #263.
- [ ] The client table points Claude Desktop to the `mcp-remote` bridge.
- [ ] The Claude web section says the request-header connector is rejected and points to Claude Code or Desktop with the bridge.
- [ ] The Claude Desktop section gives the `claude_desktop_config.json` locations for macOS and Windows.
- [ ] The Desktop config uses `"Authorization:${HUB_AUTH}"` with `HUB_AUTH` set to `Bearer dhm_…` in `env`.
- [ ] The Desktop section explains the missing space, the Node.js requirement, the plaintext token and the full quit/reopen.
- [ ] The claim that no local bridge is needed is removed.
- [ ] NOT: no speculation about why the connector's header is rejected.
- [ ] NOT: no code, locale or README change (neither repeats the false claim).

## Verify
- `grep -n "No local bridge" docs/knowledge/mcp-booking.md` → no match
- `grep -n "#263" docs/knowledge/mcp-booking.md` → matches in the table, Claude web and ChatGPT sections
- manual: add the documented entry to Claude Desktop with a real token, restart, ask to list amenities → tools respond
- `npm run lint && npm run build` → green
