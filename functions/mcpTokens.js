const crypto = require("node:crypto");
const {HttpsError} = require("firebase-functions/v2/https");

// Production hosting rollout of the new-profile verification requirement (#199,
// Actions run 43383405662). Firestore assigns createTime independently of
// editable profile data, including createdAt and emailVerificationRequired.
const verificationRollout = Date.parse("2026-11-13T07:09:51Z");

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const activeToken = (data, now = Date.now()) =>
  Boolean(data && !data.revoked && data.expiresAt > now);
// Why a token doc is not active; logged on 401 (never the token itself).
const inactiveReason = (data) =>
  !data ? "unknown" : data.revoked ? "revoked" : "expired";
const denied = (message, reason) =>
  new HttpsError("unauthenticated", message, {reason});
const retryAfterMs = (data, now = Date.now()) =>
  data && data.createdAt ? Math.max(0, data.createdAt + 60000 - now) : 0;
const tokenMetadata = (data) => ({
  active: activeToken(data),
  createdAt: data ? data.createdAt : null,
  expiresAt: data ? data.expiresAt : null,
  retryAfterMs: retryAfterMs(data),
});
// 60 requests per minute per credential (a dhm_ token or an OAuth grant).
const reserveWindow = (data, now) => {
  const window = Math.floor(now / 60000);
  const count = data.window === window ? data.count || 0 : 0;
  if (count >= 60) {
    throw new HttpsError("resource-exhausted", "Try again in one minute.");
  }
  return {window, count: count + 1};
};
const reserveRequest = (data, now) => {
  if (!activeToken(data, now)) {
    throw denied("Invalid or expired token.", inactiveReason(data));
  }
  return reserveWindow(data, now);
};

// OAuth grants (#263) store expiresAt as a Firestore Timestamp.
const grantMillis = (value) =>
  value && typeof value.toMillis === "function" ? value.toMillis() : value;
const liveGrant = (grant, now = Date.now()) =>
  Boolean(grant && !grant.revoked && grantMillis(grant.expiresAt) > now);
// The grant counter also records lastUsedAt, written once per minute: the
// first request of a new window.
const reserveGrantRequest = (grant, now) => {
  if (!liveGrant(grant, now)) {
    throw denied("Invalid or expired token.", "revoked");
  }
  const reserved = reserveWindow(grant, now);
  return grant.window === reserved.window ? reserved :
    {...reserved, lastUsedAt: now};
};

const grantSummary = (doc) => {
  const grant = doc.data();
  return {id: doc.id, clientName: grant.clientName || "",
    redirectHost: new URL(grant.redirectUri).host,
    createdAt: grant.createdAt, lastUsedAt: grant.lastUsedAt || null,
    expiresAt: grantMillis(grant.expiresAt)};
};
const GRANT_ID = /^[a-f0-9]{32}$/;
const ACTIONS = ["status", "create", "revoke", "listGrants", "revokeGrant"];

const createTokenService = (db, auth) => {
  const requireUser = async (uid) => {
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const user = await auth.getUser(uid);
    if (user.disabled) {
      throw denied("Account is disabled.", "disabled");
    }
    if (user.email && !user.emailVerified) {
      const member = await db.collection("members").doc(uid).get();
      const legacyProfile = member.createTime &&
        member.createTime.toMillis() < verificationRollout;
      if (!legacyProfile || member.data().emailVerificationRequired === true) {
        throw denied("Verify your email first.", "unverified");
      }
    }
  };
  const manage = async (request) => {
    const uid = request.auth && request.auth.uid;
    await requireUser(uid);
    const action = request.data && request.data.action;
    if (!ACTIONS.includes(action)) {
      throw new HttpsError("invalid-argument", "Unknown token action.");
    }
    if (action === "listGrants") return listGrants(uid);
    if (action === "revokeGrant") return revokeGrant(uid, request.data.grantId);
    const ownerRef = db.collection("mcpTokenOwners").doc(uid);
    if (action === "status") {
      const owner = await ownerRef.get();
      return tokenMetadata(owner.data());
    }
    const secret = "dhm_" + crypto.randomBytes(32).toString("hex");
    const hash = hashToken(secret);
    const now = Date.now();
    return db.runTransaction(async (tx) => {
      const owner = (await tx.get(ownerRef)).data();
      if (action === "create" && owner && now - owner.createdAt < 60000) {
        throw new HttpsError("resource-exhausted", "Wait one minute.",
            {retryAfterMs: retryAfterMs(owner, now)});
      }
      if (owner && owner.hash) {
        tx.delete(db.collection("mcpTokens").doc(owner.hash));
      }
      if (action === "revoke") {
        tx.set(ownerRef, {...owner, revoked: true});
        return tokenMetadata({...owner, revoked: true});
      }
      const data = {uid, createdAt: now, expiresAt: now + 90 * 86400000};
      tx.set(db.collection("mcpTokens").doc(hash), data);
      tx.set(ownerRef, {...data, hash});
      return {...tokenMetadata(data), token: secret};
    });
  };
  // Connected apps in Profile: the member's live OAuth grants, newest first.
  const listGrants = async (uid) => {
    const now = Date.now();
    const snapshot = await db.collection("oauthGrants")
        .where("uid", "==", uid).get();
    const grants = snapshot.docs.filter((doc) => liveGrant(doc.data(), now))
        .map(grantSummary).sort((a, b) => b.createdAt - a.createdAt);
    return {grants};
  };
  // Disconnect: mark the grant revoked (in-flight access tokens fail on
  // their next request) and delete its tokens in the same transaction.
  const revokeGrant = async (uid, grantId) => {
    if (typeof grantId !== "string" || !GRANT_ID.test(grantId)) {
      throw new HttpsError("invalid-argument", "Unknown app.");
    }
    const {prepareRevokeGrant} = require("./oauth/token");
    await db.runTransaction(async (tx) => {
      const grant = (await tx.get(db.collection("oauthGrants")
          .doc(grantId))).data();
      if (!grant || grant.uid !== uid) {
        throw new HttpsError("not-found", "Unknown app.");
      }
      (await prepareRevokeGrant(tx, db, grantId))(Date.now());
    });
    return {revoked: true};
  };
  // dha_ access tokens: issued by the OAuth server, accepted only through
  // Hosting on the canonical origin (`hosted`), audience-checked, 60/min per
  // grant. The requireUser gate is the same as for dhm_ tokens.
  const authenticateAccess = async (value) => {
    const {validateAccessToken} = require("./oauth/token");
    const result = await validateAccessToken(db, value);
    if (!result.uid) throw denied("Invalid or expired token.", result.reason);
    await requireUser(result.uid);
    const ref = db.collection("oauthGrants").doc(result.grantId);
    await db.runTransaction(async (tx) => {
      const grant = (await tx.get(ref)).data();
      tx.update(ref, reserveGrantRequest(grant, Date.now()));
    });
    // mcpBookings re-checks the grant in each booking transaction.
    return {uid: result.uid, grantId: result.grantId};
  };
  const authenticate = async (header, {hosted = false} = {}) => {
    if (typeof header !== "string" || !header) {
      throw denied("Supply a bearer token.", "missing");
    }
    if (/^Bearer dha_[a-f0-9]{64}$/.test(header)) {
      // Decision 1: the raw function URL stays dhm_-only.
      if (!hosted) throw denied("Supply a bearer token.", "not-hosted");
      return authenticateAccess(header.slice(7));
    }
    if (!/^Bearer dhm_[a-f0-9]{64}$/.test(header)) {
      throw denied("Supply a bearer token.", "malformed");
    }
    const hash = hashToken(header.slice(7));
    const ref = db.collection("mcpTokens").doc(hash);
    const token = (await ref.get()).data();
    if (!activeToken(token)) {
      throw denied("Invalid or expired token.", inactiveReason(token));
    }
    await requireUser(token.uid);
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      tx.update(ref, reserveRequest(current, Date.now()));
    });
    return {uid: token.uid, hash};
  };
  return {manage, authenticate, requireUser};
};

module.exports = {createTokenService, hashToken, activeToken,
  reserveGrantRequest, liveGrant};
