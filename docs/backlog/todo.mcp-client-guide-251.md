# MCP client connection guide
**Phase**: — · **Deps**: mcp-booking-server

## Goal
Resolve #251 with current, client-specific setup instructions linked from Profile.
Make bearer-token compatibility and unsupported ChatGPT flows explicit.

## Files
- `docs/knowledge/mcp-booking.md` (edited) — client setup, troubleshooting and sources
- `src/components/McpTokens.jsx` (edited) — accessible guide link
- `src/locales/en.json` (edited) — guide link label
- `src/locales/vi.json` (edited) — guide link label

## Acceptance
- [ ] Claude web/Desktop and Claude Code instructions match current official docs.
- [ ] ChatGPT limitations and supported alternatives are explicit.
- [ ] Personal credentials are never recommended for shared organization connectors.
- [ ] Profile links to setup instructions in EN and VI.
- [ ] Token expiry, replacement cooldown and read-only verification are documented.
- [ ] NOT: OAuth implementation, authentication changes or production writes.

## Verify
- `npm run lint` → pass
- `npm run build` → pass
- `npm test` → pass
- `npm --prefix functions run lint` → pass
- Profile in local preview → guide link renders in EN/VI and opens the guide.
- Review against official client docs; distinguish documented support from live testing.
