# MCP setup guide link looks like plain text
**Phase**: — · **Deps**: — · **Issue**: #264

## Goal
The setup guide link in Profile → MCP access inherits the global `a` reset (body color, no underline), so it reads as plain text. Give links in that card the accent color and underline used by other inline links.

## Files
- `src/components/McpTokens.css` (edited) — style `.mcp-access a`

## Acceptance
- [ ] The setup guide link renders in `--accent-primary` with an underline in light and dark themes
- [ ] Hover and keyboard focus thicken the underline
- [ ] NOT: change the global `a` reset in `src/styles/globals.css`

## Verify
- `npm run lint && npm run build` → green
- `npm run dev`, open `/profile` → MCP access card: guide link is orange and underlined in both themes
