// Resource-server side of MCP OAuth for the `mcp` function: which requests
// came through Hosting on the canonical origin, and the 401 challenge.
// No MCP SDK or Firestore here, so it stays cheap to load and to test.
const {ISSUER, SCOPE, DISCOVERY_ENABLED} = require("./config");

const CANONICAL_HOST = new URL(ISSUER).host;
const RESOURCE_METADATA =
  `${ISSUER}/.well-known/oauth-protected-resource/mcp`;

// Firebase Hosting proxies a rewrite to the function with the host the
// browser or client used in X-Forwarded-Host; the raw cloudfunctions.net
// URL is reached without Hosting, so nothing sets it to the canonical host.
// A proxy appends to an existing value, so the last entry is the one the
// nearest proxy (Hosting) wrote. A raw caller can forge the header, which
// only changes its own request: the challenge it then sees is public
// metadata, and a dha_ token it presents is still audience-bound to the
// canonical URL, owned by the same member and served by the same function.
const lastForwardedHost = (headers) => {
  const value = headers && headers["x-forwarded-host"];
  if (typeof value !== "string") return "";
  return value.split(",").pop().trim().toLowerCase();
};
const isHostedRequest = (req) =>
  lastForwardedHost(req && req.headers) === CANONICAL_HOST;

// Decision 1: only the canonical origin advertises OAuth. The raw function
// URL keeps the phase 1 challenge, so no client starts a sign-in there.
const challenge = (hosted, discovery = DISCOVERY_ENABLED) =>
  hosted && discovery ?
    `Bearer resource_metadata="${RESOURCE_METADATA}", scope="${SCOPE}"` :
    "Bearer realm=\"Hub MCP\"";

module.exports = {isHostedRequest, challenge, RESOURCE_METADATA,
  CANONICAL_HOST};
