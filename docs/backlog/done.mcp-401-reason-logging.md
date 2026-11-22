# Log why the MCP endpoint returned 401
**Phase**: — · **Deps**: mcp-booking-server

## Goal
Resolve #262: every 401 from the MCP HTTP endpoint looks the same in logs, so a missing header, a malformed header and an unknown or expired token can't be told apart. Tag each auth failure with a reason code and log one structured warning per 401, without any token material.

## Files
- `functions/mcpTokens.js` (edited) — `unauthenticated` errors carry `details.reason`: `missing`, `malformed`, `unknown`, `revoked`, `expired`, `disabled`, `unverified`.
- `functions/mcpServer.js` (edited) — `authFailureLog` builds the log entry; `createHttpHandler` calls `logger.warn` with it on 401 (logger injectable for tests).
- `test/mcp.test.js` (edited) — reason-code cases and a no-token-material check on the logged entry.

## Acceptance
- [ ] A request without `Authorization` logs `reason: "missing"`, `authorizationScheme: "none"`.
- [ ] A header that fails `^Bearer dhm_[a-f0-9]{64}$` logs `reason: "malformed"`.
- [ ] A well-formed token with no doc, a revoked doc or an expired doc logs `unknown`, `revoked` or `expired`.
- [ ] `auth/user-not-found` from `requireUser` logs `reason: "user-not-found"`.
- [ ] The entry holds reason, user agent (max 200 chars), header presence, header length and scheme word (`Bearer`, `bearer-case`, `other`, `none`).
- [ ] NOT: log the token, any part of it past the scheme word, or its hash.
- [ ] NOT: change the 401 body, the `WWW-Authenticate` header, or the 429 and 503 paths.
- [ ] NOT: change error messages returned by `authenticate` or the `manageMcpToken` callable.

## Verify
- `npm test` → `test/mcp.test.js` passes, including the two new 401 tests.
- `npm run lint`, `npm run build`, `npm --prefix functions run lint` → green.
- After deploy: `gcloud logging read 'jsonPayload.message="MCP request refused with 401"' --limit 5` shows the reason fields.

## Notes
Revoking deletes the `mcpTokens/{hash}` doc, so a revoked token usually logs `unknown`; `revoked` only shows if a doc still has `revoked: true`. The `bearer-case` scheme flags clients that send lowercase `bearer`, which the strict regex rejects.
