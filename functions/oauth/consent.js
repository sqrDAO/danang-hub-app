// POST /oauth/consent-action on the `oauth` function: describe, approve or
// deny a stored authorization request for the signed-in member, from the
// browser that started it. The consent page calls it same-origin through a
// Hosting rewrite, so the browser-binding cookie (./browser.js) arrives;
// a callable on cloudfunctions.net would never see that cookie.
const {HttpsError} = require("firebase-functions/v2/https");
const {ISSUER, LIFETIME} = require("./config");
const {sha256, randomHex, ts, expired, loopbackParts} = require("./util");
const {redirectWith} = require("./authorize");
const {readBrowserId, requireSameBrowser} = require("./browser");

const REQUEST_ID = /^[a-f0-9]{32}$/;
const SCOPE_TEXT = {bookings: "See amenities and availability, and list, " +
  "create and cancel your own bookings."};

const shortWallet = (uid) => {
  const address = uid.slice(4);
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};
const accountLabel = (user) => {
  if (user.email) return user.email;
  return /^(eth|sol)_/.test(user.uid) ? shortWallet(user.uid) : user.uid;
};

const createConsentService = (db, auth, requireUser) => {
  const requestRef = (id) => {
    if (typeof id !== "string" || !REQUEST_ID.test(id)) {
      throw new HttpsError("invalid-argument", "Unknown request.");
    }
    return db.collection("oauthRequests").doc(id);
  };
  const liveRequest = (data, now) => {
    if (expired(data, now)) {
      throw new HttpsError("not-found", "This sign-in request expired. " +
        "Start again from your AI app.");
    }
    return data;
  };
  const describe = async (uid, id, browser, now) => {
    const request = liveRequest((await requestRef(id).get()).data(), now);
    requireSameBrowser(request, browser);
    const client = (await db.collection("oauthClients")
        .doc(request.clientId).get()).data() || {};
    const user = await auth.getUser(uid);
    return {
      clientName: client.clientName || "",
      clientNameSelfDeclared: true,
      redirectHost: new URL(request.redirectUri).host,
      loopback: Boolean(loopbackParts(request.redirectUri)),
      scopes: [{scope: request.scope, text: SCOPE_TEXT[request.scope]}],
      account: accountLabel({...user, uid}),
    };
  };
  // Single use: the request is consumed in the same transaction that
  // creates the grant and the code. A browser without the binding throws
  // before any write, so the request stays usable from the right browser.
  const decide = (uid, {request: id, browser}, approve, now) => {
    const ref = requestRef(id);
    return db.runTransaction(async (tx) => {
      const request = liveRequest((await tx.get(ref)).data(), now);
      requireSameBrowser(request, browser);
      const client = (await tx.get(db.collection("oauthClients")
          .doc(request.clientId))).data();
      tx.delete(ref);
      const state = request.state === null ? undefined : request.state;
      if (!approve) {
        return {redirectUrl: redirectWith(request.redirectUri, {
          error: "access_denied", state})};
      }
      if (expired(client, now)) {
        throw new HttpsError("not-found", "This app registration expired.");
      }
      const grantId = randomHex(16);
      const grantRef = db.collection("oauthGrants").doc(grantId);
      const code = randomHex(32);
      tx.set(grantRef, {uid, clientId: request.clientId,
        clientName: client.clientName || "", redirectUri: request.redirectUri,
        resource: request.resource, scope: request.scope, revoked: false,
        createdAt: now, lastUsedAt: null,
        expiresAt: ts(now + LIFETIME.grant)});
      tx.set(db.collection("oauthCodes").doc(sha256(code)), {
        grantId, uid, clientId: request.clientId,
        redirectUri: request.redirectUri, resource: request.resource,
        codeChallenge: request.codeChallenge, scope: request.scope,
        usedAt: null, expiresAt: ts(now + LIFETIME.code)});
      return {redirectUrl: redirectWith(request.redirectUri, {code, state})};
    });
  };
  // input: {action, request, browser}; browser is the cookie's browser id.
  const handle = async (uid, input, now = Date.now()) => {
    await requireUser(uid);
    const {action} = input;
    if (action === "describe") {
      return describe(uid, input.request, input.browser, now);
    }
    if (action === "approve" || action === "deny") {
      return decide(uid, input, action === "approve", now);
    }
    throw new HttpsError("invalid-argument", "Unknown consent action.");
  };
  return {handle};
};

const signedInUid = async (verifyIdToken, idToken) => {
  if (typeof idToken !== "string" || !idToken) {
    throw new HttpsError("unauthenticated", "Sign in first.");
  }
  try {
    return (await verifyIdToken(idToken)).uid;
  } catch (error) {
    throw new HttpsError("unauthenticated", "Sign in first.");
  }
};

// The member proves identity with a Firebase ID token in the JSON body, the
// browser with the cookie. CSRF: the cookie is SameSite=Lax (no cross-site
// POST carries it), an attacker cannot mint the member's ID token, and the
// Origin must be the Hub's own.
const consentAction = async ({verifyIdToken, service}, req, now) => {
  if (req.headers.origin !== ISSUER) {
    return {status: 403, body: {error: "permission-denied",
      reason: "origin", message: "Cross-origin request refused."}};
  }
  const {action, request, idToken} = req.body || {};
  try {
    const uid = await signedInUid(verifyIdToken, idToken);
    const browser = readBrowserId(req.headers.cookie);
    const body = await service().handle(uid, {action, request, browser}, now);
    return {status: 200, body};
  } catch (error) {
    if (!(error instanceof HttpsError)) throw error;
    return {status: error.httpErrorCode.status, body: {error: error.code,
      reason: (error.details && error.details.reason) || undefined,
      message: error.message}};
  }
};

module.exports = {createConsentService, consentAction};
