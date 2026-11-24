# MCP: list upcoming Hub events
**Phase**: — · **Deps**: — · **Issue**: #299

## Goal
The MCP server only books amenities, so an agent can't tell a member what's on at the Hub. Add a read-only `list_upcoming_events` tool returning approved future events, nearest first, with what a member needs to decide and a portal link to register.

## Files
- `functions/mcpEvents.js` (new) — `createEventTools(db, memberFor)`: the query, cursor, event view
- `functions/mcpBookings.js` (edited) — merges the event tool into the MCP handlers, sharing `memberFor`
- `functions/mcpServer.js` (edited) — tool definition, instructions line, server version 1.2.0
- `test/mcp.test.js` (edited) — event tool cases; seven tools over HTTP
- `test/helpers/mcpStore.js` (edited) — `>` filters, `orderBy(field)` and snapshot cursors
- `docs/knowledge/mcp-booking.md`, `README.md` (edited) — tool table, tool count

## Acceptance
- [x] `list_upcoming_events` lists approved events starting after now
- [x] Pending, rejected and past events are not listed
- [x] Events come nearest first
- [x] `limit` (1–50, default 20) and `nextCursor` page through them
- [x] An unknown or non-approved cursor is rejected with a message
- [x] Each event has id, title, startTime, endTime, durationMinutes and timezone
- [x] Each event has organizer name, hosting projects and venue name (null without a Hub space)
- [x] Each event has capacity, attendeeCount, waitlistCount and spotsLeft (null when uncapped)
- [x] Each event says whether the caller is registered or waitlisted
- [x] Each event has its eventLink and a portal `registerUrl`
- [x] Descriptions over 1000 characters are cut, with `descriptionTruncated: true`
- [x] A revoked token or grant is refused, as on the other tools
- [x] The tool is annotated read-only and non-destructive
- [x] Server instructions name `list_upcoming_events` and say registering is in the portal
- [x] NOT: attendee or waitlist member IDs in the result
- [x] NOT: registering, unregistering, waitlisting or event creation through MCP
- [x] NOT: a new Firestore index (uses `status` + `date` ascending)

## Verify
- `npm test` → `test/mcp.test.js` passes, including the event cases
- `cd functions && npm run lint` → clean
- `npm run lint && npm run build` → green
- Firestore emulator, real `firebase-admin` query → approved future events nearest first, equal start times paged without loss, pending cursor refused
- regression: the six booking tools' cases in `test/mcp.test.js`

## Notes
- Upcoming = start time after now, as on the portal's Events page (`filterUpcomingEvents`).
- Events are public reads (`firestore.rules`), but attendee lists are member IDs, so only counts and the caller's own state leave the server.
- The OAuth `bookings` scope covers this tool too; no consent change.
