# Book through an MCP client

Issue #149, with OAuth sign-in from #263. The server uses stateless Streamable
HTTP with JSON responses. Two ways to authenticate:

- **Sign in (OAuth 2.1)**, for Claude web, Desktop and mobile custom connectors:
  add `https://app.danangblockchainhub.com/mcp`, sign in with your Hub account
  and approve. Only this Hosting URL offers sign-in; design in
  [`mcp-oauth-design.md`](mcp-oauth-design.md).
- **Personal token** (`dhm_`), for clients that send an `Authorization: Bearer`
  header (Claude Code, OpenClaw, Hermes, the `mcp-remote` bridge). Works at the
  Hosting URL and the raw function URL.

## Member setup: personal token

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
Apps connected by sign-in are listed under Profile → **Book with your AI agent**
→ **Connected apps**; **Disconnect** ends that app's access at its next request.
One token is active per member. Permissions are member-scoped even for admins.
Revocation prevents new requests; an already completed request is not undone.
The server also rejects disabled/deleted Firebase accounts on every request
and honors the profile’s required-email-verification gate.

## Choose your client

Client documentation checked **2026-11-21**, sign-in rows updated with #263
phase 3. These instructions describe documented compatibility; the phase 3
post-deploy checks (Claude web, Claude Desktop) confirm the sign-in rows.

| Client | Current Hub connection |
| --- | --- |
| Claude web, individual account | **Sign in**: custom connector with the Hosting URL, no header; steps below |
| Claude Desktop, individual account | **Sign in**: same custom connector (synced with Claude web). The local `mcp-remote` bridge with a token still works |
| Claude Code | HTTP server with an environment-backed bearer header; steps below |
| OpenClaw (current native MCP registry) | Streamable HTTP with an environment-backed header |
| Hermes Agent (NousResearch) | Remote HTTP with an environment-backed header |
| Claude Team / Enterprise shared connector | Do not install a member's personal token as an organization-wide credential |
| ChatGPT custom MCP app/plugin | **Sign in** (OAuth). End-to-end verification with ChatGPT is #263 phase 4 |

### Claude web

1. In Claude, open **Customize → Connectors → Add custom connector** (wording may
   vary by plan).
2. Name it `danang-hub` and enter `https://app.danangblockchainhub.com/mcp`. Leave
   the advanced OAuth client fields and request headers empty: Claude registers
   itself with the Hub.
3. Click **Connect**. The Hub portal opens: sign in (email, Google or wallet),
   verify your email if asked, then check the consent page. It shows the app's
   self-declared name and where it sends you back (`claude.ai`). **Approve**.
4. Back in Claude, enable the connector in a chat and ask: “Use danang-hub to
   list amenities. Do not create a booking.”

Disconnect in the Hub (Profile → **Connected apps**) or remove the connector in
Claude. Do not use the raw `cloudfunctions.net` URL here: it accepts only
personal tokens and offers no sign-in.

**Do not connect a shared workspace connector to your own account:** its users
would act as you.

### Claude Desktop

Use the same custom connector as Claude web (**Customize → Connectors**); Desktop
opens the Hub sign-in in your browser. Connectors added on Claude web also appear
in Desktop.

Alternative with a personal token: run the open-source `mcp-remote` bridge
locally. Desktop starts it as a local server, and it forwards each request to the
Hub with your header. It needs Node.js 18 or newer on your system (Desktop uses
the system Node).

1. Open the Desktop config file, creating it if missing (**Settings → Developer →
   Edit Config** opens it):
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add the `danang-hub` entry under `mcpServers` (merge with existing entries),
   replacing `dhm_YOUR_TOKEN` with your saved token:

```json
{
  "mcpServers": {
    "danang-hub": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://app.danangblockchainhub.com/mcp",
        "--header",
        "Authorization:${HUB_AUTH}"
      ],
      "env": {
        "HUB_AUTH": "Bearer dhm_YOUR_TOKEN"
      }
    }
  }
}
```

3. Fully quit Claude Desktop (**Cmd+Q** on macOS, or quit from the tray on
   Windows; closing the window is not enough) and reopen it.
4. Check that **danang-hub** appears under **+ → Connectors** (or the tools menu)
   and ask: “Use danang-hub to list amenities. Do not create a booking.”

There is deliberately **no space** after `Authorization:` in `args`: some clients
split arguments on spaces, so the space lives in the `HUB_AUTH` value instead.
The token is stored **in plaintext** in this file: keep it private, out of backups
you share and out of source control. After rotating the token, edit `HUB_AUTH` and
restart Desktop. Use either the bridge or the sign-in connector, not both, to
avoid duplicate tools.

Sources: [mcp-remote custom headers](https://github.com/punkpeye/mcp-remote#custom-headers)
and [MCP's Claude Desktop local server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

### Claude Code

Install and sign in to Claude Code first. In macOS/Linux **bash**, read the token
without placing it in shell history, then register an HTTP server in user scope:

```bash
read -r -s -p 'Hub token: ' DANANG_HUB_TOKEN
printf '\n'
export DANANG_HUB_TOKEN
claude mcp add --transport http --scope user danang-hub \
  https://app.danangblockchainhub.com/mcp \
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
Claude Desktop's settings. If organization policy blocks custom
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
openclaw mcp set danang-hub '{"transport":"streamable-http","url":"https://app.danangblockchainhub.com/mcp","headers":{"Authorization":"Bearer ${DANANG_HUB_TOKEN}"}}'
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
    url: "https://app.danangblockchainhub.com/mcp"
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
A client that supports only OAuth can use sign-in at the Hosting URL if its
callback is on the allowlist (Claude, ChatGPT, or a loopback
`http://localhost|127.0.0.1:<port>/callback`); unauthenticated HTTP, stdio and
legacy SSE clients do not match this server.

### ChatGPT

ChatGPT's custom MCP flow supports OAuth, which the Hub now offers at
`https://app.danangblockchainhub.com/mcp`. Add it under **Plugins → + → Add
custom MCP server** (legacy: **Settings → Apps → Create**), subject to
account/workspace permissions, choose OAuth, and sign in and approve in the Hub
as for Claude web. ChatGPT registers itself; do not paste a personal token (it
cannot send custom API keys). End-to-end verification with ChatGPT, including
its stable callback, is phase 4 of
[#263](https://github.com/sqrDAO/danang-hub-app/issues/263); until then, use Claude
if the ChatGPT connection fails.

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
| Sign-in connector says it can't connect, or asks to sign in again | Use the exact Hosting URL (`app.danangblockchainhub.com/mcp`, not the raw function URL). After Disconnect, or 90 days after approving, reconnect and approve again. |
| Consent page says the request expired | Requests last 10 minutes and work once: start the connection again from the AI app. |
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

- 60 HTTP POST requests per token (or per sign-in grant) per minute, including initialization/discovery;
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
  Each sign-in grant also has a mirror doc `mcpTokens/oauth_<grantId>` (`{uid,
  grantId, expiresAt}` in epoch ms) that the booking tools' in-transaction
  credential check reads; Disconnect and grant revocation delete it.
- Token creation responses stay in React component state, never query caches or
  persistent browser storage. Status queries contain metadata only. No token/body
  logging is added. Old token documents are deleted on replacement/revocation.

## First deployment and smoke checks

The Hosting PR preview does **not** deploy these functions. An owner must deploy
both new functions with their normal authenticated Firebase CLI identity:

```sh
firebase deploy --project danang-hub-app --only functions:mcp,functions:manageMcpToken
```

The endpoint is `https://app.danangblockchainhub.com/mcp`, a Firebase Hosting
rewrite (`firebase.json`) to the `mcp` function. The raw function URL
`https://us-central1-danang-hub-app.cloudfunctions.net/mcp` keeps working with
the same tokens, so existing client configs need no change.
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

### OAuth sign-in (#263 phases 2 and 3)

The `oauth` function and `oauthConsent` callable serve the authorization
server; both must be publicly invokable and do their own validation. Hosting
rewrites send `/.well-known/oauth-*` and `/oauth/register|authorize|token|revoke`
to `oauth`; `/oauth/consent` is the SPA consent page. Discovery is on
(`DISCOVERY_ENABLED` in `functions/oauth/config.js`); setting it to `false`
returns the three metadata paths to JSON 404 and drops `resource_metadata`
from the 401 without touching issued grants.

`mcp` tells Hosting requests from raw ones by `X-Forwarded-Host` (last entry)
equal to `app.danangblockchainhub.com` (`functions/oauth/resource.js`): only
those get `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp", scope="bookings"`
and may use `dha_` access tokens. The raw URL keeps `Bearer realm="Hub MCP"`
and rejects `dha_` (401 reason `not-hosted`). A forged header on the raw URL
only changes that caller's own response; `dha_` tokens stay audience-bound.

One-time, as project owner: enable Firestore TTL on `expiresAt` (all values are
Timestamps) so expired OAuth documents are deleted. TTL deletes within about
24 h of expiry; the code already treats expired documents as absent.

```sh
for c in oauthClients oauthRequests oauthCodes oauthGrants oauthTokens oauthRateLimits; do
  gcloud firestore fields ttls update expiresAt --collection-group=$c \
    --enable-ttl --project=danang-hub-app
done
```

Smoke checks after deploy (no member data involved):
`curl -si -X POST https://app.danangblockchainhub.com/mcp` returns 401 with
`resource_metadata`, while the raw function URL's 401 has only
`realm="Hub MCP"`;
`curl -si https://app.danangblockchainhub.com/.well-known/oauth-protected-resource/mcp`
returns 200 with `"resource":"https://app.danangblockchainhub.com/mcp"`, and
`.../.well-known/oauth-authorization-server` lists
`code_challenge_methods_supported: ["S256"]`; a registration
with `{"redirect_uris":["https://evil.example/cb"]}` posted to `/oauth/register`
returns 400 `invalid_redirect_uri`. Time a cold `POST /oauth/token` (decision
5: Claude allows 10 s).

Local checks: `npm test`, `npm run test:rules`, both lint commands and build.
`test/mcp.test.js` drives the real SDK HTTP client against an isolated repository;
`test/firestore-mcp.rules.test.js` verifies real emulator transaction contention
and default-deny rules. The local skip-auth profile explains why token actions
are disabled; it cannot issue production credentials.

Protocol references: [SDK v1 stateless example](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/server/simpleStatelessStreamableHttp.ts)
and [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
The maintained v1 SDK is used to match this project's CommonJS Functions runtime.
