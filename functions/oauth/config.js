// OAuth 2.1 authorization server constants for the MCP connector flow.
// Design: docs/knowledge/mcp-oauth-design.md (issue #263).
const ISSUER = "https://app.danangblockchainhub.com";
const RESOURCE = `${ISSUER}/mcp`;
const SCOPE = "bookings";
// offline_access is accepted on requests; refresh tokens are issued anyway.
const REQUEST_SCOPES = [SCOPE, "offline_access"];
// Phase 2 deployed the server dark (all three discovery paths answered
// 404). Phase 3 switches discovery on: the protected-resource documents (at
// the root and at /mcp) and the authorization-server document are served,
// and `mcp` points at them from its 401 when reached through Hosting.
// Setting this back to false turns sign-in discovery off again without
// touching issued grants (existing dha_ tokens keep working until revoked).
const DISCOVERY_ENABLED = true;

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

// Phase 4: CIMD for the allowlisted client_id URLs in ./cimd.js; RFC 9207
// `iss` is on every authorization response (authorize.js redirectWith).
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
  client_id_metadata_document_supported: true,
});

module.exports = {
  ISSUER, RESOURCE, SCOPE, REQUEST_SCOPES, DISCOVERY_ENABLED, HOUR, DAY,
  LIFETIME, LIMITS,
  protectedResourceMetadata, authorizationServerMetadata,
};
