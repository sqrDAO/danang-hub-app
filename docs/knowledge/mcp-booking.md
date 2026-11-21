# Book through an MCP client

Issue #149, phase 1. The server uses stateless Streamable HTTP with JSON responses
and personal bearer tokens. It does not implement OAuth discovery/authorization;
clients requiring OAuth (including one-click connection flows) are not supported
by this phase. A client must allow an `Authorization` header on each request.

## Member setup

1. Sign in to the Hub and complete your name, company and role.
2. Open Profile → **Book with your AI agent** → **Generate token**.
3. Save the token securely when it appears; it cannot be retrieved again.
4. Configure your MCP client with the URL shown in Profile and an HTTP header:
   `Authorization: Bearer YOUR_PERSONAL_TOKEN`. Use the client's secret store or
   environment-variable support; never paste it into chat, URLs or source control.
5. Ask the agent to list amenities, check a future slot, then confirm your booking.
6. Revoke the token in Profile to disconnect. Generate a replacement after
   revocation (at least one minute after the last generation).

Tokens expire after 90 days and work for email, Google and wallet accounts.
One token is active per member. Permissions are member-scoped even for admins.
Revocation prevents new requests; an already completed request is not undone.
The server also rejects disabled/deleted Firebase accounts on every request
and honors the profile’s required-email-verification gate.

## Tool behavior

| Tool | Input | Result |
| --- | --- | --- |
| `list_amenities` | optional limit (1–50), cursor | Amenity IDs, type, configured hours, capacity; inaccessible partner desks omitted |
| `check_availability` | amenityId, startTime, endTime | Availability and anonymous busy ranges, without member or booking IDs |
| `get_my_hours_left` | month (`YYYY-MM`) | Used/remaining hours of the 40-hour monthly ad-hoc desk allowance |
| `list_my_bookings` | optional limit, cursor | Own booking IDs, times, status and source |
| `create_booking` | amenityId, startTime, endTime, requestId | Pending booking; reuse requestId for retries of exactly the same slot |
| `cancel_booking` | bookingId | Cancellation of an own pending individual booking only |

Dates require an explicit offset (`2026-12-01T09:00:00+07:00`); Hub time is
Asia/Ho_Chi_Minh. Slots must be in the future, within a year, at most 24 hours,
and inside amenity hours on a single Hub day. Read tools paginate by document ID,
not date. Follow `nextCursor` until null, including when a filtered page is empty.
A new requestId means a new booking attempt, even if the previous booking was
cancelled. Fixed/partner desk plans, event creation and admin operations are absent.

Creation checks the current profile, reserved-amenity access, closures, hours and
capacity in a Firestore transaction. A per-amenity lock serializes MCP creates;
query reads reuse `computeBookingAvailability`, including pending-renewal behavior.
The existing portal's advisory write path is unchanged: this does not retrofit
transactional enforcement onto every writer. The shared monthly-hour logic powers
`get_my_hours_left`; the existing auto-approval trigger enforces the limit after
creation. **Pending is not confirmation**: list bookings again for final status.
Admins see an **AI agent** badge on `source: 'mcp'` bookings.

## Limits and storage

- 60 HTTP POST requests per token per minute, including initialization/discovery;
  HTTP 429 includes `Retry-After: 60`. Counter reservations are transactional.
- 16 KiB request limit; no server-side sessions or GET event stream (405).
- Unexpected Origin headers get 403; desktop/server clients normally omit Origin.
  The three production Hub origins are explicitly allowed. No permissive CORS.
- Availability fails closed above 1,000 active bookings for an amenity. Monthly
  hours fail closed above 2,000 own bookings or 500 amenities. Contact an owner
  to revisit bounds if reached; do not return partial availability/usage.
- Tokens use 256 bits of randomness; only SHA-256 hashes and metadata are stored.
  `mcpTokens`, `mcpTokenOwners` and `mcpBookingLocks` remain default-deny to all
  Firestore clients, including admins. Do not add client-side rules for them.
- Token creation responses stay in React component state, never query caches or
  persistent browser storage. Status queries contain metadata only. No token/body
  logging is added. Old token documents are deleted on replacement/revocation.

## First deployment and smoke checks

The Hosting PR preview does **not** deploy these functions. An owner must deploy
both new functions with their normal authenticated Firebase CLI identity:

```sh
firebase deploy --project danang-hub-app --only functions:mcp,functions:manageMcpToken
```

The runtime endpoint is
`https://us-central1-danang-hub-app.cloudfunctions.net/mcp`.
Cloud Run/Functions must permit invocation so the function can perform bearer
validation itself. This is not anonymous booking access. If invoker setup fails,
follow the owner IAM recovery runbook from #234/#245; do not grant broad project
roles to the CI account. Do not run an all-functions deploy to repair this endpoint.

After first deploy, use a disposable test member and the MCP Inspector or an SDK
client with a bearer header: initialize, list all six tools, check availability,
create with a unique requestId, repeat it (same ID), list own bookings, cancel a
still-pending test booking, revoke, and confirm the old token receives 401.
Check disabled-user rejection, 429 limits, and pending-to-approved monthly-limit
behavior. Approved desk bookings intentionally cannot be cancelled through MCP.
Never include the secret in screenshots or test reports. Run this in emulators
first; production smoke bookings require appropriate test data and cleanup.

Local checks: `npm test`, `npm run test:rules`, both lint commands and build.
`test/mcp.test.js` drives the real SDK HTTP client against an isolated repository;
`test/firestore-mcp.rules.test.js` verifies real emulator transaction contention
and default-deny rules. The local skip-auth profile explains why token actions
are disabled; it cannot issue production credentials.

Protocol references: [SDK v1 stateless example](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/server/simpleStatelessStreamableHttp.ts)
and [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
The maintained v1 SDK is used to match this project's CommonJS Functions runtime.
