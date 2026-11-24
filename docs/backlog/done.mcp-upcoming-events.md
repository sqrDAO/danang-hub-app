# MCP: list upcoming Hub events
**Phase**: — · **Deps**: — · **Issue**: #299

## Goal
The MCP server only books amenities, so an agent can't tell a member what's on at the Hub. Add a read-only `list_upcoming_events` tool returning approved future events, nearest first, with what the portal's member view shows and where to register.

## Files
- `functions/mcpEvents.js` (new) — `createEventTools(db, memberFor)`: the query, start-time cursor, event view, organizer lookup
- `functions/mcpBookings.js` (edited) — merges the event tool into the MCP handlers, sharing `memberFor`
- `functions/mcpServer.js` (edited) — tool definition, instructions line, server version 1.2.0
- `test/mcp.test.js` (edited) — event tool cases; seven tools over HTTP
- `test/helpers/mcpStore.js` (edited) — `>` filters, `orderBy` fields and value cursors, as in Firestore
- `docs/knowledge/mcp-booking.md`, `README.md`, `docs/knowledge/mcp-oauth-design.md` (edited) — tool table, tool count, scope
- `functions/oauth/consent.js`, `src/locales/en.json`, `src/locales/vi.json` (edited) — consent and token help mention events

## Acceptance
- [x] `list_upcoming_events` lists approved events starting after now
- [x] Pending, rejected and past events are not listed
- [x] Events come nearest first
- [x] `limit` (1–50, default 20) and `nextCursor` page through them
- [x] Moving the last-listed event between pages skips no event
- [x] A malformed cursor is rejected with a message
- [x] Each event has id, title, startTime, endTime, durationMinutes and timezone
- [x] Each event has organizer name and hosting projects
- [x] An event without a stored organizer name gets it from its organizer's profile
- [x] Each event says whether the caller is registered or waitlisted
- [x] An event with an http(s) `eventLink` has `signUp: "event-page"`, `registerUrl` = that link and `isFull: null`
- [x] Any other event has `signUp: "hub"`, the portal register URL and `isFull` from Hub capacity
- [x] A non-http(s) `eventLink` is returned as null
- [x] Descriptions over 1000 characters are cut on a whole character, with `descriptionTruncated: true`
- [x] A revoked token or grant is refused, as on the other tools
- [x] The tool is annotated read-only and non-destructive
- [x] Tool description and instructions say opening a Hub `registerUrl` registers at once
- [x] The OAuth consent text names upcoming events and registration state
- [x] The token help text (EN, VI) names upcoming events and registration state
- [x] NOT: venue, capacity, attendee or waitlist counts (hidden in the portal's member view)
- [x] NOT: attendee or waitlist member IDs in the result
- [x] NOT: registering, unregistering, waitlisting or event creation through MCP
- [x] NOT: a new Firestore index (uses `status` + `date` ascending, then document ID)

## Verify
- `npm test` → `test/mcp.test.js` passes, including the event cases
- `cd functions && npm run lint` → clean
- `npm run lint && npm run build` → green
- Firestore emulator, real `firebase-admin` query → approved future events nearest first; equal start times paged without loss; moving the last-listed event skips nothing
- regression: the six booking tools' cases in `test/mcp.test.js`

## Notes
- Upcoming = start time after now, as on the portal's Events page (`filterUpcomingEvents`).
- Results follow the portal's member view (`EVENT_VIEWS.member`, `RESTRICTED_FIELDS` in `src/components/event/eventFields.js`); events with their own page follow `hasEventPage`.
- The OAuth `bookings` scope covers this tool too; no consent change.
