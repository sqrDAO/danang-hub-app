# MCP booking caps: open pending limit and per-member daily quota
**Phase**: — · **Deps**: mcp-correctness-fixes-302 · **Issue**: [#301](https://github.com/sqrDAO/danang-hub-app/issues/301)

## Goal
Stop a runaway agent or leaked token from holding rooms in bulk through MCP.
Cap a member's open MCP-made pending non-desk bookings and their MCP creates per Hub day, across all tokens and grants.

## Files
- `functions/mcpQuota.js` (new) — limits, hub-day key, pure quota and open-pending helpers
- `firestore.indexes.json` (edited) — `bookings` index on memberId, source, status, endTime for the open-pending query
- `functions/mcpBookings.js` (edited) — `create_booking` transaction applies both checks and bumps the counter
- `functions/mcpServer.js` (edited) — instructions and `create_booking` description mention the limits
- `test/mcpQuota.test.js` (new) — unit tests for the helpers
- `test/mcp.test.js` (edited) — handler tests: cap, quota, desks exempt from cap, idempotent retry not counted
- `test/firestore-mcp.rules.test.js` (edited) — `mcpMemberQuotas` in the server-only list; emulator test of the cap across two tokens
- `docs/knowledge/mcp-booking.md` (edited) — Limits and storage section
- `README.md` (edited) — `mcpMemberQuotas` collection row

## Acceptance
- [ ] `create_booking` for a non-desk amenity is refused when the member already holds 5 pending, not-yet-ended `source: 'mcp'` non-desk bookings.
- [ ] Desk bookings neither count toward nor are blocked by the open-pending cap.
- [ ] A 21st MCP create on one Hub day (Asia/Ho_Chi_Minh) is refused for that member, whichever token or grant is used.
- [ ] The daily counter resets on the next Hub day.
- [ ] An idempotent retry of an existing `requestId` is not refused and not counted.
- [ ] A refused create writes no booking and no counter change.
- [ ] The open-pending check fails closed above 100 pending MCP bookings that haven't ended.
- [ ] Pending bookings that have already ended never block a create.
- [ ] `mcpMemberQuotas` denies all client reads and writes, admins included.
- [ ] NOT: limits on portal bookings.
- [ ] NOT: changes to the per-credential 60/min rate limit.
- [ ] NOT: new horizon or duration caps (the existing 1-year / 24-hour `assertRange` stays).

## Verify
- `npm test` → all pass, including `test/mcpQuota.test.js` and new `test/mcp.test.js` cases
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → green
- `npm run test:rules` → `mcpMemberQuotas` denied (needs Java; otherwise CI)
- regression: existing create/idempotency tests in `test/mcp.test.js`

## Notes
- The pending query filters `endTime > now`, so it needs the new composite index. CI can't deploy indexes: an owner runs `firebase deploy --only firestore:indexes` and waits for the index to build **before** merging, or non-desk MCP creates fail until it is ready.
- Every read happens before the transaction's writes; the counter doc is read in the same transaction, so concurrent creates serialize on it.
