// GET /oauth/authorize: validate, store the request, send the member to the
// consent page. Nothing redirects before the client and redirect URI pass.
const {ISSUER, RESOURCE, SCOPE, REQUEST_SCOPES, LIFETIME, LIMITS} =
  require("./config");
const {sha256, randomHex, ts, expired, redirectMatches, CHALLENGE} =
  require("./util");
const {readBrowserId, browserCookie} = require("./browser");
const {isUrlClientId, resolveCimdClient} = require("./cimd");

const CLIENT_ID = /^dhc_[a-f0-9]{32}$/;

const loadClient = async (db, clientId, now, tx) => {
  if (typeof clientId !== "string" || !CLIENT_ID.test(clientId)) return null;
  const ref = db.collection("oauthClients").doc(clientId);
  const client = (await (tx ? tx.get(ref) : ref.get())).data();
  return expired(client, now) ? null : client;
};

// Either form of client_id: a DCR id (oauthClients) or an allowlisted CIMD
// URL. Returns {client} or {error: {kind, description}}; kind
// "unavailable" means the CIMD document could not be fetched.
const resolveClient = async (db, clientId, {now = Date.now(),
  fetchCimd} = {}) => {
  if (isUrlClientId(clientId)) {
    return resolveCimdClient(clientId, {now, fetch: fetchCimd});
  }
  const client = await loadClient(db, clientId, now);
  return client ? {client} :
    {error: {kind: "invalid", description: "Unknown or expired client_id."}};
};

// Authorization response URL with RFC 9207 `iss` on success and error.
const redirectWith = (redirectUri, params) => {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries({...params, iss: ISSUER})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
};

const errorPage = (message, status = 400) => ({status, page: message});
const errorRedirect = (redirectUri, state, error, description) => ({
  status: 302,
  location: redirectWith(redirectUri, {
    error, error_description: description, state,
  }),
});

const isText = (value) => value === undefined || typeof value === "string";
// Granted scope is always "bookings"; offline_access only asks for refresh,
// which every grant gets anyway.
const checkScope = (scope) => {
  const parts = (scope || "").split(" ").filter(Boolean);
  return parts.every((s) => REQUEST_SCOPES.includes(s)) ? SCOPE : null;
};

// Returns the error redirect for the first failing parameter, or null.
const requestError = (query) => {
  const {response_type: type, code_challenge: challenge, state} = query;
  const method = query.code_challenge_method;
  const fields = [type, challenge, method, query.resource, query.scope, state];
  if (!fields.every(isText) || (state && state.length > LIMITS.state)) {
    return ["invalid_request", "Malformed parameters."];
  }
  if (type !== "code") {
    return ["unsupported_response_type", "Only response_type=code."];
  }
  if (method !== "S256" || !CHALLENGE.test(challenge || "")) {
    return ["invalid_request", "PKCE with code_challenge_method=S256 " +
      "is required."];
  }
  if (query.resource !== undefined && query.resource !== RESOURCE) {
    return ["invalid_target", `resource must be ${RESOURCE}.`];
  }
  if (!checkScope(query.scope)) {
    return ["invalid_scope", `Supported scopes: ${REQUEST_SCOPES.join(" ")}.`];
  }
  return null;
};

// What the consent page needs about a CIMD client, which has no
// oauthClients doc: its name from the validated document.
const cimdFields = (client) => client.cimd ?
  {cimd: true, clientName: client.clientName} : {};

// `cookie` is the request's Cookie header (browser binding, ./browser.js).
// `fetchCimd` replaces fetch for CIMD documents (tests).
const authorize = async (db, query, {now = Date.now(), cookie,
  fetchCimd} = {}) => {
  const q = query || {};
  const {client, error} = await resolveClient(db, q.client_id,
      {now, fetchCimd});
  if (error) {
    return error.kind === "unavailable" ?
      errorPage("Couldn't load this app's registration; try again " +
        "shortly.", 503) :
      errorPage("Unknown or expired client_id.");
  }
  if (!redirectMatches(client.redirectUris, q.redirect_uri)) {
    return errorPage("redirect_uri is not registered for this client.");
  }
  const failure = requestError(q);
  if (failure) {
    return errorRedirect(q.redirect_uri, typeof q.state === "string" ?
      q.state : undefined, ...failure);
  }
  const id = randomHex(16);
  const browserId = readBrowserId(cookie) || randomHex(32);
  const ref = db.collection("oauthRequests").doc(id);
  await db.runTransaction(async (tx) => {
    tx.set(ref, {
      clientId: q.client_id, redirectUri: q.redirect_uri,
      codeChallenge: q.code_challenge, resource: RESOURCE,
      scope: checkScope(q.scope), state: q.state === undefined ?
        null : q.state,
      browserHash: sha256(browserId), ...cimdFields(client),
      createdAt: now, expiresAt: ts(now + LIFETIME.request),
    });
  });
  return {status: 302, headers: {"Set-Cookie": browserCookie(browserId)},
    location: `${ISSUER}/oauth/consent?request=${id}`};
};

module.exports = {
  authorize, loadClient, resolveClient, redirectWith, checkScope,
};
