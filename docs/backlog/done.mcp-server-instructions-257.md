# MCP server instructions and tool metadata
**Phase**: — · **Deps**: mcp-booking-server

## Goal
Resolve #257: send MCP server `instructions` on `initialize` so agents learn the booking flow, Hub timezone and pending-status rule without the docs.
Give every tool a human title, describe every input field, and stop marking `create_booking` destructive.

## Files
- `functions/mcpServer.js` (edited) — instructions, titles, field descriptions, annotations
- `test/mcp.test.js` (edited) — instructions, titles and annotations over a real client
- `docs/knowledge/mcp-booking.md` (edited) — note that the server sends instructions

## Acceptance
- [ ] `initialize` returns instructions naming the list → check → confirm → create flow.
- [ ] Instructions state Asia/Ho_Chi_Minh time with an explicit offset.
- [ ] Instructions state that pending is not confirmed.
- [ ] Instructions say to follow `nextCursor` until null, even after a short or empty page.
- [ ] Instructions state the 60 requests per minute limit.
- [ ] Instructions say to call `get_my_hours_left` before booking a desk.
- [ ] All six tools have a human title.
- [ ] `amenityId` description names `list_amenities` as its source.
- [ ] `bookingId` description names `list_my_bookings` as its source.
- [ ] `month` description gives the `YYYY-MM` format.
- [ ] `limit` description says pages can be short or empty.
- [ ] `cursor` description names `nextCursor` as its source.
- [ ] `destructiveHint` is true only for `cancel_booking`.
- [ ] NOT: changes to tool behavior, input validation, auth or rate limits.

## Verify
- `npm test` → pass, including the new instructions/metadata test
- `npm --prefix functions run lint` → pass
- `npm run lint` → pass
- `npm run build` → pass
- regression: existing `test/mcp.test.js` client tests still list 6 tools
