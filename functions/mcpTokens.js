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
const retryAfterMs = (data, now = Date.now()) =>
  data && data.createdAt ? Math.max(0, data.createdAt + 60000 - now) : 0;
const tokenMetadata = (data) => ({
  active: activeToken(data),
  createdAt: data ? data.createdAt : null,
  expiresAt: data ? data.expiresAt : null,
  retryAfterMs: retryAfterMs(data),
});
const reserveRequest = (data, now) => {
  if (!activeToken(data, now)) {
    throw new HttpsError("unauthenticated", "Invalid or expired token.");
  }
  const window = Math.floor(now / 60000);
  const count = data.window === window ? data.count || 0 : 0;
  if (count >= 60) {
    throw new HttpsError("resource-exhausted", "Try again in one minute.");
  }
  return {window, count: count + 1};
};

const createTokenService = (db, auth) => {
  const requireUser = async (uid) => {
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const user = await auth.getUser(uid);
    if (user.disabled) {
      throw new HttpsError("unauthenticated", "Account is disabled.");
    }
    if (user.email && !user.emailVerified) {
      const member = await db.collection("members").doc(uid).get();
      const legacyProfile = member.createTime &&
        member.createTime.toMillis() < verificationRollout;
      if (!legacyProfile || member.data().emailVerificationRequired === true) {
        throw new HttpsError("unauthenticated", "Verify your email first.");
      }
    }
  };
  const manage = async (request) => {
    const uid = request.auth && request.auth.uid;
    await requireUser(uid);
    const action = request.data && request.data.action;
    if (!["status", "create", "revoke"].includes(action)) {
      throw new HttpsError("invalid-argument", "Unknown token action.");
    }
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
  const authenticate = async (header) => {
    if (typeof header !== "string" ||
        !/^Bearer dhm_[a-f0-9]{64}$/.test(header)) {
      throw new HttpsError("unauthenticated", "Supply a bearer token.");
    }
    const hash = hashToken(header.slice(7));
    const ref = db.collection("mcpTokens").doc(hash);
    const token = (await ref.get()).data();
    if (!activeToken(token)) {
      throw new HttpsError("unauthenticated", "Invalid or expired token.");
    }
    await requireUser(token.uid);
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      tx.update(ref, reserveRequest(current, Date.now()));
    });
    return {uid: token.uid, hash};
  };
  return {manage, authenticate};
};

module.exports = {createTokenService, hashToken, activeToken, reserveRequest};
