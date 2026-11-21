# Member MCP booking server
**Phase**: 1 · **Deps**: — · **Issue**: [#149](https://github.com/sqrDAO/danang-hub-app/issues/149)

## Goal
Let members use a bearer personal access token to book through an MCP client.
Enforce ownership, complete profiles, availability and abuse limits server-side.

## Files
- `functions/mcp*.js` (new) — token lifecycle, booking tools and HTTP transport
- `functions/index.js` (edited) — exports and shared availability injection
- `functions/package.json`, `functions/package-lock.json` (edited) — MCP SDK
- `src/services/mcpTokens.js` (new) — callable service boundary
- `src/components/McpTokens.jsx`, `src/components/McpTokens.css` (new) — profile token controls
- `src/pages/member/Profile.jsx` (edited) — mount token controls
- `src/pages/admin/Bookings.jsx` (edited) — label agent-created bookings
- `src/locales/en.json`, `src/locales/vi.json` (edited) — token UI strings
- `test/mcp.test.js`, `test/helpers/mcpStore.js` (new) — isolated protocol tests
- `test/firestore-mcp.rules.test.js` (new) — client denial and contention
- `.github/workflows/rules-tests.yml` (edited) — install Admin SDK for tests
- `docs/reviews/149-mcp-profile.jpg` (new) — local UI preview
- `README.md`, `docs/knowledge/mcp-booking.md` (edited/new) — setup and deploy

## Acceptance
- [ ] Members generate one token, see its secret once, and revoke it.
- [ ] Only a SHA-256 hash is stored; tokens expire after 90 days.
- [ ] Requests reject revoked tokens and disabled/deleted Firebase users.
- [ ] Required email verification also applies to token access.
- [ ] Each token is limited to 60 requests per minute transactionally.
- [ ] Six tools list amenities, availability, hours and own bookings, create
  pending bookings and cancel only own pending bookings.
- [ ] Create checks complete profile and amenity access and fails closed.
- [ ] Transactional create serializes MCP requests and reuses availability logic.
- [ ] Bookings carry `source: 'mcp'` and an idempotency key for safe retries.
- [ ] Secret and counter documents have no client access under default-deny rules.
- [ ] EN/VI profile controls explain permissions, expiry and client limitations.
- [ ] NOT: OAuth, events, admin tools, fixed/partner plans or automatic deployment.

## Verify
- `npm run lint`, `npm --prefix functions run lint`, `npm test`, `npm run build`.
- Protocol integration: initialize, list tools and call read/write tools through
  the SDK HTTP client with a fake isolated repository; auth failures deny access.
- Regression: rejected/foreign cancellation, incomplete profile, conflict failure,
  duplicate create, unknown fields, expired token and concurrent rate reservation.
- Profile UI in skip-auth mode: explanatory disabled state; EN/VI strings render.
- Owner first-deploy and real token smoke checks follow the deployment runbook.
