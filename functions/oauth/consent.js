// oauthConsent callable: describe, approve or deny a stored authorization
// request for the signed-in member. The consent page (phase 3) calls it.
const {HttpsError} = require("firebase-functions/v2/https");
const {LIFETIME} = require("./config");
const {sha256, randomHex, ts, expired, loopbackParts} = require("./util");
const {redirectWith} = require("./authorize");
const {grantCredentialRef} = require("./credential");

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
  const describe = async (uid, id, now) => {
    const request = liveRequest((await requestRef(id).get()).data(), now);
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
  // creates the grant and the code.
  const decide = (uid, id, approve, now) => {
    const ref = requestRef(id);
    return db.runTransaction(async (tx) => {
      const request = liveRequest((await tx.get(ref)).data(), now);
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
      // Mirror for the booking tools' in-transaction credential check
      // (credential.js); epoch ms like a dhm_ token doc.
      tx.set(grantCredentialRef(db, grantId), {uid, grantId,
        createdAt: now, expiresAt: now + LIFETIME.grant});
      tx.set(db.collection("oauthCodes").doc(sha256(code)), {
        grantId, uid, clientId: request.clientId,
        redirectUri: request.redirectUri, resource: request.resource,
        codeChallenge: request.codeChallenge, scope: request.scope,
        usedAt: null, expiresAt: ts(now + LIFETIME.code)});
      return {redirectUrl: redirectWith(request.redirectUri, {code, state})};
    });
  };
  const handle = async (request, now = Date.now()) => {
    const uid = request.auth && request.auth.uid;
    await requireUser(uid);
    const {action, request: id} = request.data || {};
    if (action === "describe") return describe(uid, id, now);
    if (action === "approve" || action === "deny") {
      return decide(uid, id, action === "approve", now);
    }
    throw new HttpsError("invalid-argument", "Unknown consent action.");
  };
  return {handle};
};

module.exports = {createConsentService};
