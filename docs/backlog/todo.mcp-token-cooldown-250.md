# Explain MCP token generation cooldown
**Phase**: — · **Deps**: mcp-booking-server

## Goal
Resolve #250 by explaining the existing one-minute generation cooldown after revocation. Keep server enforcement and revoked-token rejection intact.

## Files
- `functions/mcpTokens.js` — return cooldown duration with metadata and throttle errors.
- `src/components/McpTokens.jsx` — show remaining wait, disable generation until eligible, and recover from cross-tab throttle responses.
- `src/hooks/useMcpTokenCooldown.js` — countdown based on server remaining duration.
- `src/locales/en.json`, `src/locales/vi.json` — translated cooldown guidance.
- `test/mcp.test.js` — exercise revoke/regenerate before and after cooldown.

## Acceptance
- [ ] Revoking a recently generated token keeps the cooldown visible.
- [ ] Generate becomes available automatically when cooldown expires.
- [ ] Server throttle responses show wait guidance, including stale-tab attempts.
- [ ] Revoked tokens remain unusable before and after replacement.
- [ ] NOT: weaken the one-minute server throttle or store plaintext secrets.

## Verify
- `npm run lint`, `npm run build`, `npm --prefix functions run lint`, `npm test` pass.
- Local UI fixture: check cooldown EN/VI, revoked state, and automatic button re-enable.
