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

## Choose your client

Client documentation checked **2026-11-21**. These instructions describe documented
compatibility; they are not a claim that each signed-in client has been tested.

| Client | Current Hub connection |
| --- | --- |
| Claude web, individual account | Remote connector with a personal request header |
| Claude Desktop, individual account | Same remote connector through Customize; not a local stdio server |
| Claude Code | HTTP server with an environment-backed bearer header; steps below |
| OpenClaw (current native MCP registry) | Streamable HTTP with an environment-backed header |
| Hermes Agent (NousResearch) | Remote HTTP with an environment-backed header |
| Claude Team / Enterprise shared connector | Do not install a member's personal token as an organization-wide credential |
| ChatGPT custom MCP app/plugin | Not compatible with this personal-token server yet; OAuth support is required |

### Claude web

Use a personal account for this personal Hub token.

1. Open **Customize → Connectors → + Add → Add custom connector**.
2. Name it **Da Nang Hub** and enter
   `https://us-central1-danang-hub-app.cloudfunctions.net/mcp`.
3. Review the detected authentication settings and continue if prompted. Choose
   **No sign in** (the Hub uses a token, not OAuth). Under **Request headers**,
   add `Authorization` with value
   `Bearer YOUR_PERSONAL_TOKEN`, replacing the placeholder with your saved token.
4. Finish adding it. In a conversation, use **+ → Connectors** to enable Da Nang Hub.
5. Ask: “Use Da Nang Hub to list amenities. Do not create a booking.”

Availability and settings depend on your account. Anthropic currently lists Free
(one custom connector), Pro, Max, Ultra, Team and Enterprise. Workspace installation
requires an authorized owner/admin. **Do not put your personal Hub token in a
shared workspace connector:** its users would act as you. Use a personal account
or Claude Code instead. Replacing a connector's header may require removing and
re-adding it.

Source: [Anthropic's remote connector setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

### Claude Desktop

1. Open the Claude Desktop app and sign in to your personal Claude account.
2. Open **Customize → Connectors** and follow the Claude web steps above, including
   **No sign in** and the `Authorization: Bearer …` request header.
3. Enable **Da Nang Hub** from **+ → Connectors** in the conversation and run the
   read-only amenities prompt. If already added on the web, enable that connector
   rather than creating a duplicate.

This is a **remote connector**, reached through Anthropic's cloud. Do not paste
this HTTPS URL into `claude_desktop_config.json` as a local executable: Desktop's
local stdio-server setup is a different path. No local bridge is needed for the
remote-header flow. If your Desktop build lacks these controls, use Claude web
or Claude Code; do not assume the local JSON supports the same fields.

Source: [Anthropic's remote connector and Desktop distinction](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

### Claude Code

Install and sign in to Claude Code first. In macOS/Linux **bash**, read the token
without placing it in shell history, then register an HTTP server in user scope:

```bash
read -r -s -p 'Hub token: ' DANANG_HUB_TOKEN
printf '\n'
export DANANG_HUB_TOKEN
claude mcp add --transport http --scope user danang-hub \
  https://us-central1-danang-hub-app.cloudfunctions.net/mcp \
  --header 'Authorization: Bearer ${DANANG_HUB_TOKEN}'
claude
```

The single quotes deliberately save an environment-variable reference, not the
secret. Set `DANANG_HUB_TOKEN` in each new shell before starting Claude Code, or
inject it through your own secret manager. Do not commit the token or put it in
shared shell configuration. In Claude Code, open `/mcp`, check `danang-hub`, and
try the read-only amenities prompt above. `claude mcp list` lists configured
servers and `claude mcp get danang-hub` inspects this entry; do not share output
that could contain credentials. This terminal configuration is separate from
Claude Desktop's remote connector settings. If organization policy blocks custom
servers, ask your administrator. Revoke in the Hub to invalidate a token;
`claude mcp remove danang-hub --scope user` only removes the local connection.

Source: [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp).

### OpenClaw

These steps target current OpenClaw's native **outbound MCP registry**, not
`openclaw mcp serve` (which exposes OpenClaw itself) or older MCPorter setups.
Check `openclaw mcp --help` for `set` and `probe`; if absent, use your installed
version's documented MCPorter path or update before using these commands.

1. Make `DANANG_HUB_TOKEN` available in the environment of both the setup CLI and
   the Gateway/agent process, using your secret manager. For a local bash session,
   use the hidden `read`/`export` commands in the Claude Code section.
2. Save a definition containing the variable reference, not the secret:

```bash
openclaw mcp set danang-hub '{"transport":"streamable-http","url":"https://us-central1-danang-hub-app.cloudfunctions.net/mcp","headers":{"Authorization":"Bearer ${DANANG_HUB_TOKEN}"}}'
openclaw mcp doctor danang-hub
```

3. With the Gateway stopped, run `openclaw mcp probe danang-hub` to discover tools.
   Then start your Gateway normally with the token environment available and ask
   it to list Hub amenities. A service-managed Gateway does not inherit variables
   exported in a separate terminal; configure its secret environment separately.
4. If tools are hidden, check the runtime's MCP support and tool policy. The
   `minimal` profile or a `bundle-mcp` denial can hide them. Do not enable OAuth
   for this bearer-token connection.

Keep this member credential on a personal instance: people able to command the
same agent could use its Hub access. Restart the consuming Gateway/agent after
replacing its token environment; a CLI `mcp reload` does not reload other processes.

Sources: [OpenClaw registry commands](https://docs.openclaw.ai/cli/mcp/registry)
and [HTTP headers and transport](https://docs.openclaw.ai/cli/mcp/transports).

### Hermes Agent (NousResearch)

This section refers to **NousResearch Hermes Agent**, not other products named
Hermes. Add the following under `mcp_servers` in `~/.hermes/config.yaml` (merge it
with existing entries):

```yaml
mcp_servers:
  danang-hub:
    url: "https://us-central1-danang-hub-app.cloudfunctions.net/mcp"
    headers:
      Authorization: "Bearer ${DANANG_HUB_TOKEN}"
    skip_preflight: true
    trust: untrusted
```

1. Put `DANANG_HUB_TOKEN` in the active Hermes profile's secret environment
   (the default profile uses `~/.hermes/.env`), or supply it through your secret
   manager/process environment. Keep that secret file private and out of Git.
2. Start `hermes chat`, or run `/reload-mcp` in an existing session. Ask it to
   list Hub amenities without creating a booking, then check your own bookings.
3. With approvals enabled, `trust: untrusted` asks before tools that are not
   marked read-only, including Hub writes. Do not use YOLO mode or turn approvals
   off to get a connection working.

Hermes defaults remote URLs to Streamable HTTP; do not set `transport: sse`.
`skip_preflight` skips only Hermes' preliminary HEAD/GET content-type test because
this Hub endpoint is POST-only; it does not disable TLS or bearer authentication.
Named profiles need their own secret setup. Do not share this personal credential
through a multi-user bot. After rotation, update the secret and reload the server.

Sources: [Hermes MCP guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/mcp.md)
and [configuration reference](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/mcp-config-reference.md).

### Other agentic clients

Use the same endpoint only if the client supports **Streamable HTTP** and a
per-request `Authorization: Bearer …` header. Names for configuration fields vary:
Claude Code uses `mcpServers`, OpenClaw uses `mcp.servers`, and Hermes uses
`mcp_servers`; do not copy an entire config between products without checking its
schema. Begin with a private, read-only test and keep write approvals enabled.
A client that supports only OAuth, unauthenticated HTTP, stdio, or legacy SSE does
not directly match this server's current setup.

### ChatGPT

**The current Hub server cannot be connected directly in ChatGPT.** OpenAI's
custom MCP flow supports OAuth or unauthenticated servers, and its authentication
documentation says ChatGPT cannot supply custom API keys. Our server requires a
personal bearer token and does not offer OAuth. Selecting “No authentication”
will not bypass Hub authentication. Do not paste your token into a chat or URL.

ChatGPT's current entry point is **Plugins → + → Add custom MCP server**, subject
to account/workspace permissions; legacy interfaces may show **Settings → Apps →
Create**. These menus alone do not make this Hub server compatible. Use Claude's
personal-header flow or Claude Code above for now. A future Hub OAuth integration
needs separate implementation and verification before ChatGPT setup can work.

Sources: [OpenAI connection instructions](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
and [authentication requirements](https://developers.openai.com/plugins/build/auth).

## Verify and troubleshoot

Start with read-only requests: “List my Hub bookings” or “Check desk availability
tomorrow from 09:00 to 12:00 in Da Nang time; do not book.” Confirm the date and
amenity before requesting a booking. **Pending is not confirmed**: ask for the
booking status again after submission.

| Symptom | What to do |
| --- | --- |
| Generate fails soon after revoking | Wait until 60 seconds after the previous generation, then retry. Revoking does not reset this cooldown. |
| 401 / invalid or expired token | Check the `Bearer ` prefix and token, with no extra quotes. Tokens expire after 90 days; revoked tokens cannot be restored. |
| Replacement token still fails | Update the client's saved header/environment, then reconnect or restart it. Only one token is active per member. |
| Verify-email / incomplete-profile error | Sign in to the Hub, complete required verification and profile fields, then retry. |
| 429 / too many requests | Pause at least one minute; avoid automatic retry loops. |
| No tools / connection error | Confirm the exact HTTPS endpoint, HTTP transport, credential support and workspace permission. A browser GET of the endpoint is not an MCP test. |

Keep the token in the client's credential settings or your secret manager, never
in prompts, screenshots or source control. If lost or exposed, revoke it in
Profile, wait out any generation cooldown, generate a replacement and update
each client that used it. Disconnecting a client does not revoke the Hub token.

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

The server sends these rules to clients as MCP `instructions` on `initialize`
(`functions/mcpServer.js`): the list → check → confirm → create flow, Hub time,
pending-is-not-confirmed, `nextCursor` paging and the request limit. Keep that
string in step with this section when tool behavior changes.

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
