// Pure push-token logic, kept out of index.js so it can be unit-tested without
// initializing firebase-admin. Mirrors the split waitlist.js uses.

/**
 * Groups a member's stored token entries by token.
 *
 * During the legacy transition an upgraded phone's token sits in both
 * push_tokens/{uid} and its device doc. It must be sent once, but a dead token
 * has to be deleted from every doc that holds it.
 *
 * @param {Array<{token: string, ref: *}>} entries Stored entries
 * @return {Array<{token: string, refs: Array}>} One item per distinct token
 */
const groupTokenEntries = (entries) => {
  const byToken = new Map();
  entries.forEach(({token, ref}) => {
    if (typeof token !== "string" || !token) return;
    const refs = byToken.get(token) || [];
    refs.push(ref);
    byToken.set(token, refs);
  });
  return [...byToken].map(([token, refs]) => ({token, refs}));
};

/**
 * Decides each member's dedupe marker from per-token send outcomes.
 *
 * Markers are per member, not per phone: a member counts as delivered when any
 * of their phones succeeded, and is released for retry only when all failed.
 * Outcomes must span every batch, because one member's tokens can be split
 * across batches.
 *
 * @param {Array<{memberId: string, success: boolean}>} outcomes Per token
 * @return {{marked: Array<string>, released: Array<string>}} Member ids
 */
const decideMemberMarkers = (outcomes) => {
  const delivered = new Map();
  outcomes.forEach(({memberId, success}) => {
    delivered.set(memberId, delivered.get(memberId) === true || success);
  });
  const marked = [];
  const released = [];
  delivered.forEach((success, memberId) => {
    (success ? marked : released).push(memberId);
  });
  return {marked, released};
};

module.exports = {groupTokenEntries, decideMemberMarkers};
