# MCP small correctness fixes
**Phase**: — · **Deps**: — · **Issue**: [#302](https://github.com/sqrDAO/danang-hub-app/issues/302)

## Goal
Bring three MCP tools in line with their documented scope: no event-space
cancels, an exempt result for admins' desk hours, and one checked list of
required profile fields. Declare the test-only `express` dependency.

## Files
- `functions/mcpBookings.js` (edited) — event-space cancel refusal, admin-exempt hours, exported `REQUIRED_PROFILE_KEYS`
- `functions/mcpServer.js` (edited) — tool descriptions mention the new behavior
- `functions/package.json`, `functions/package-lock.json` (edited) — `express` devDependency
- `test/mcp.test.js` (edited) — event-space cancel, admin hours, profile-field parity tests
- `docs/knowledge/mcp-booking.md` (edited) — tool table rows for hours and cancel

## Acceptance
- [ ] `cancel_booking` refuses a member's own pending event-space booking with a message pointing to the portal.
- [ ] `get_my_hours_left` returns `exempt: true` and null `hoursLeft`/`limit` for admins.
- [ ] `get_my_hours_left` for members returns the same shape as before plus `exempt: false`.
- [ ] `get_my_hours_left` refuses a revoked token or a missing member profile, like the other tools.
- [ ] `cancel_booking` still cancels an own pending booking that has no `amenityId`.
- [ ] The `cancel_booking` tool description names the event-space refusal.
- [ ] A test fails if `REQUIRED_PROFILE_KEYS` and `src/utils/profileFields.js` keys differ.
- [ ] `express` is a devDependency of `functions/`.
- [ ] NOT: changing portal cancel rules or `firestore.rules`.
- [ ] NOT: deleting the deployed `oauthConsent` function (owner housekeeping, item 5).

## Verify
- `npm test` → all pass, including the new MCP tests
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → green
- regression: existing `cancel_booking` and `get_my_hours_left` tests in `test/mcp.test.js`
