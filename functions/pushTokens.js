const MAX_PUSH_TOKENS_PER_MEMBER = 5;

/**
 * Reads a stored FCM token and its recency from a Firestore data object.
 * @param {Object} data Token document data
 * @return {{token: string, ts: number}|null}
 */
function readPushTokenRecord(data) {
  if (!data || typeof data.token !== "string") return null;
  const token = data.token.trim();
  if (!token) return null;
  const ts = new Date(data.updatedAt || data.createdAt || 0).getTime();
  return {token, ts: Number.isFinite(ts) ? ts : 0};
}

/**
 * Newest-first unique tokens, capped. Used by getPushTokens after it has
 * gathered subcollection docs and the optional legacy flat-doc token.
 *
 * The legacy token is merged in by the caller as just another {token, ts}
 * record — never gated on an empty subcollection — so a phone that has not
 * launched the new build still receives push after another device registers.
 * @param {Array<{token: string, ts: number}>} tokenDocs Token records
 * @param {number} [max] Delivery cap
 * @return {Array<string>} Tokens to send, newest first
 */
function selectPushTokens(tokenDocs, max = MAX_PUSH_TOKENS_PER_MEMBER) {
  const docs = (Array.isArray(tokenDocs) ? tokenDocs : [])
      .filter((doc) => doc && doc.token);
  docs.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const tokens = [];
  const seen = new Set();
  docs.forEach((doc) => {
    if (tokens.length >= max) return;
    if (seen.has(doc.token)) return;
    seen.add(doc.token);
    tokens.push(doc.token);
  });
  return tokens;
}

module.exports = {
  MAX_PUSH_TOKENS_PER_MEMBER,
  readPushTokenRecord,
  selectPushTokens,
};
