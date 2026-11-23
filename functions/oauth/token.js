// POST /oauth/token and /oauth/revoke, plus access-token validation for the
// resource server (`mcp`, via mcpTokens.js). Only SHA-256 hashes of
// codes and tokens are stored.
const {LIFETIME, RESOURCE} = require("./config");
const {sha256, randomHex, ts, millis, expired, verifyPkce} =
  require("./util");
const {loadClient, checkScope} = require("./authorize");
const {UNUSED_DOC, GRANTS} = require("./register");

const ACCESS = /^dha_[a-f0-9]{64}$/;
const REFRESH = /^dhr_[a-f0-9]{64}$/;
const CODE = /^[a-f0-9]{64}$/;

const fail = (error, description, status = 400) =>
  ({status, body: {error, error_description: description}});
const invalidGrant = (description) => fail("invalid_grant", description);

const tokens = (db) => db.collection("oauthTokens");
const grantTokensQuery = (db, grantId) =>
  tokens(db).where("grantId", "==", grantId);

// Reads first (Firestore transactions require it), then returns a writer
// that marks the grant revoked and deletes all of its tokens. mcpBookings
// re-checks the grant, so in-flight booking transactions fail too.
const prepareRevokeGrant = async (tx, db, grantId) => {
  const grantRef = db.collection("oauthGrants").doc(grantId);
  const grant = await tx.get(grantRef);
  const owned = await tx.get(grantTokensQuery(db, grantId));
  return (now) => {
    if (grant.exists) tx.update(grantRef, {revoked: true, revokedAt: now});
    owned.docs.forEach((doc) => tx.delete(tokens(db).doc(doc.id)));
  };
};

const writeTokens = (tx, db, grantId, grant, now) => {
  const access = "dha_" + randomHex(32);
  const refresh = "dhr_" + randomHex(32);
  const base = {grantId, uid: grant.uid, clientId: grant.clientId,
    aud: grant.resource, scope: grant.scope, createdAt: now};
  const refreshEnd = Math.min(now + LIFETIME.refresh,
      millis(grant.expiresAt));
  tx.set(tokens(db).doc(sha256(access)), {...base, type: "access",
    expiresAt: ts(now + LIFETIME.access)});
  tx.set(tokens(db).doc(sha256(refresh)), {...base, type: "refresh",
    rotatedAt: null, expiresAt: ts(refreshEnd)});
  return {status: 200, body: {
    access_token: access, token_type: "Bearer",
    expires_in: LIFETIME.access / 1000, refresh_token: refresh,
    scope: grant.scope,
  }};
};

// Every token exchange keeps a client alive 30 more days; the first one
// also takes it off the unused-client ceiling.
const prepareClientUse = async (tx, db, clientId) => {
  const clientRef = db.collection("oauthClients").doc(clientId);
  const unusedRef = db.collection("oauthRateLimits").doc(UNUSED_DOC);
  const client = (await tx.get(clientRef)).data();
  const unused = client && !client.usedAt ?
    (await tx.get(unusedRef)).data() : null;
  return (now) => {
    if (!client) return;
    tx.update(clientRef, {usedAt: client.usedAt || now,
      expiresAt: ts(now + LIFETIME.usedClient)});
    const buckets = unused && unused.buckets;
    const hour = client.registeredHour;
    if (buckets && buckets[hour] > 0) {
      tx.set(unusedRef, {buckets: {...buckets, [hour]: buckets[hour] - 1}});
    }
  };
};

const liveGrant = (grant, now) => grant && !grant.revoked &&
  !expired(grant, now);

// Which failures consume the code: a wrong client_id, redirect_uri or
// resource is a request error the client can correct and retry, so the code
// stays valid (it still dies after 60 s). A failed PKCE check burns it, so a
// stolen code allows one verifier guess. Only a code that already issued
// tokens counts as used, so only its replay revokes the grant.
const codeError = (code, grant, params, now) =>
  expired(code, now) ? "Code expired." :
  code.clientId !== params.client_id ? "Code was issued to another client." :
  code.redirectUri !== params.redirect_uri ? "redirect_uri mismatch." :
  params.resource !== undefined && params.resource !== code.resource ?
    "resource mismatch." :
  !verifyPkce(params.code_verifier, code.codeChallenge) ?
    {burn: "PKCE verification failed."} :
  !liveGrant(grant, now) ? {burn: "Grant revoked or expired."} : null;

const exchangeCode = (db, params, now) => {
  if (typeof params.code !== "string" || !CODE.test(params.code)) {
    return Promise.resolve(invalidGrant("Unknown code."));
  }
  const codeRef = db.collection("oauthCodes").doc(sha256(params.code));
  return db.runTransaction(async (tx) => {
    const code = (await tx.get(codeRef)).data();
    if (!code) return invalidGrant("Unknown code.");
    if (code.burnedAt) return invalidGrant("Code is no longer valid.");
    const grantRef = db.collection("oauthGrants").doc(code.grantId);
    const grant = (await tx.get(grantRef)).data();
    if (code.usedAt) {
      // A replayed code means it leaked: revoke what it issued.
      (await prepareRevokeGrant(tx, db, code.grantId))(now);
      return invalidGrant("Code already used.");
    }
    const bad = codeError(code, grant, params, now);
    if (bad && bad.burn) {
      tx.update(codeRef, {burnedAt: now});
      return invalidGrant(bad.burn);
    }
    if (bad) return invalidGrant(bad);
    const useClient = await prepareClientUse(tx, db, code.clientId);
    tx.update(codeRef, {usedAt: now});
    useClient(now);
    return writeTokens(tx, db, code.grantId, grant, now);
  });
};

const refreshTokens = (db, params, now) => {
  const token = params.refresh_token;
  if (typeof token !== "string" || !REFRESH.test(token)) {
    return Promise.resolve(invalidGrant("Unknown refresh token."));
  }
  const ref = tokens(db).doc(sha256(token));
  return db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    if (!data || data.type !== "refresh") {
      return invalidGrant("Unknown refresh token.");
    }
    if (data.clientId !== params.client_id) {
      return invalidGrant("Token was issued to another client.");
    }
    if (data.rotatedAt) {
      // Reuse of a rotated refresh token (OAuth 2.1 4.3.1): kill the grant.
      (await prepareRevokeGrant(tx, db, data.grantId))(now);
      return invalidGrant("Refresh token already used.");
    }
    const grantRef = db.collection("oauthGrants").doc(data.grantId);
    const grant = (await tx.get(grantRef)).data();
    const bad = expired(data, now) ? "Refresh token expired." :
      !liveGrant(grant, now) ? "Grant revoked or expired." :
      params.resource !== undefined && params.resource !== grant.resource ?
        "resource mismatch." :
      params.scope !== undefined && !checkScope(params.scope) ?
        "Scope exceeds the grant." : null;
    if (bad) return invalidGrant(bad);
    const useClient = await prepareClientUse(tx, db, data.clientId);
    tx.update(ref, {rotatedAt: now});
    useClient(now);
    return writeTokens(tx, db, data.grantId, grant, now);
  });
};

const GRANT_HANDLERS = new Map([
  ["authorization_code", exchangeCode],
  ["refresh_token", refreshTokens],
]);

const isForm = (headers) => /^application\/x-www-form-urlencoded\b/i
    .test((headers && headers["content-type"]) || "");

const token = async (db, params, {now = Date.now(), headers} = {}) => {
  if (!isForm(headers)) {
    return fail("invalid_request",
        "Use application/x-www-form-urlencoded.");
  }
  const p = params || {};
  const client = await loadClient(db, p.client_id, now);
  if (!client) return fail("invalid_client", "Unknown client_id.", 401);
  const handler = GRANT_HANDLERS.get(p.grant_type);
  if (!handler) {
    return fail("unsupported_grant_type",
        "Use authorization_code or refresh_token.");
  }
  // RFC 6749 5.2: a grant type the client did not register. Clients stored
  // without grantTypes get the registration default (both).
  if (!(client.grantTypes || GRANTS).includes(p.grant_type)) {
    return fail("unauthorized_client",
        `Client is not registered for ${p.grant_type}.`);
  }
  return handler(db, p, now);
};

// RFC 7009: always 200 for unknown or foreign tokens. Revoking a refresh
// token ends its whole grant; an access token is deleted on its own.
const revoke = async (db, params, {now = Date.now(), headers} = {}) => {
  if (!isForm(headers)) {
    return fail("invalid_request",
        "Use application/x-www-form-urlencoded.");
  }
  const p = params || {};
  if (typeof p.client_id !== "string") {
    return fail("invalid_client", "client_id is required.", 401);
  }
  const value = p.token;
  if (typeof value !== "string" ||
    !(ACCESS.test(value) || REFRESH.test(value))) {
    return {status: 200, body: {}};
  }
  const ref = tokens(db).doc(sha256(value));
  await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    if (!data || data.clientId !== p.client_id) return;
    if (data.type === "refresh") {
      (await prepareRevokeGrant(tx, db, data.grantId))(now);
    } else {
      tx.delete(ref);
    }
  });
  return {status: 200, body: {}};
};

// For `mcp`: resolve a dha_ bearer token to {uid, grantId} or
// return the reason it is rejected. The audience must be the MCP URL.
const validateAccessToken = async (db, value, {now = Date.now(),
  audience = RESOURCE} = {}) => {
  if (typeof value !== "string" || !ACCESS.test(value)) {
    return {reason: "malformed"};
  }
  const data = (await tokens(db).doc(sha256(value)).get()).data();
  if (!data || data.type !== "access") return {reason: "unknown"};
  if (expired(data, now)) return {reason: "expired"};
  if (data.aud !== audience) return {reason: "audience"};
  const grant = (await db.collection("oauthGrants").doc(data.grantId)
      .get()).data();
  if (!liveGrant(grant, now)) return {reason: "revoked"};
  return {uid: data.uid, grantId: data.grantId};
};

module.exports = {
  token, revoke, validateAccessToken, prepareRevokeGrant,
};
