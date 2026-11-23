// OAuth 2.1 authorization server constants for the MCP connector flow.
// Design: docs/knowledge/mcp-oauth-design.md (issue #263).
const ISSUER = "https://app.danangblockchainhub.com";
const RESOURCE = `${ISSUER}/mcp`;
const SCOPE = "bookings";
// offline_access is accepted on requests; refresh tokens are issued anyway.
const REQUEST_SCOPES = [SCOPE, "offline_access"];
// Phase 2 deploys the server dark: both discovery documents answer 404 so no
// connector starts a sign-in before the consent page exists. Hosting keeps
// the well-known rewrites (without them the SPA catch-all would answer
// 200 text/html), and clients that find no protected-resource metadata fall
// back to /.well-known/oauth-authorization-server at the origin (MCP
// 2025-03-26), so that document is gated too. Phase 3 sets this to true.
const DISCOVERY_ENABLED = false;

const SECOND = 1000;
const HOUR = 3600 * SECOND;
const DAY = 24 * HOUR;
const LIFETIME = {
  request: 10 * 60 * SECOND,
  code: 60 * SECOND,
  access: HOUR,
  refresh: 30 * DAY,
  grant: 90 * DAY,
  unusedClient: DAY,
  usedClient: 30 * DAY,
};
const LIMITS = {
  hostedPerHour: 500,
  loopbackPerIpHour: 10,
  unusedClients: 5000,
  clientName: 64,
  redirectUris: 5,
  redirectUriLength: 256,
  state: 1024,
};

const protectedResourceMetadata = () => ({
  resource: RESOURCE,
  authorization_servers: [ISSUER],
  scopes_supported: [SCOPE],
  bearer_methods_supported: ["header"],
});

// client_id_metadata_document_supported is added in phase 4 (CIMD).
const authorizationServerMetadata = () => ({
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/oauth/authorize`,
  token_endpoint: `${ISSUER}/oauth/token`,
  registration_endpoint: `${ISSUER}/oauth/register`,
  revocation_endpoint: `${ISSUER}/oauth/revoke`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  revocation_endpoint_auth_methods_supported: ["none"],
  scopes_supported: REQUEST_SCOPES,
  authorization_response_iss_parameter_supported: true,
});

module.exports = {
  ISSUER, RESOURCE, SCOPE, REQUEST_SCOPES, DISCOVERY_ENABLED, HOUR, DAY,
  LIFETIME, LIMITS,
  protectedResourceMetadata, authorizationServerMetadata,
};
