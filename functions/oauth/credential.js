// Each OAuth grant has a mirror doc in `mcpTokens` with the same shape as a
// dhm_ token doc ({uid, expiresAt: epoch ms}). mcpBookings.js re-checks
// `mcpTokens/{principal.hash}` inside every booking transaction; giving a
// dha_ principal the mirror's id as its `hash` lets that check cover OAuth
// grants without changing the booking tools. The id cannot collide with a
// dhm_ token hash (64 hex chars) and no bearer value maps to it. Approving
// consent creates the mirror; revoking the grant deletes it.
const grantCredentialId = (grantId) => `oauth_${grantId}`;
const grantCredentialRef = (db, grantId) =>
  db.collection("mcpTokens").doc(grantCredentialId(grantId));

module.exports = {grantCredentialId, grantCredentialRef};
