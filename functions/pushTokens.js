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

/**
 * @param {Object} member Member Firestore document data
 * @return {boolean} True if the member opted into push notifications
 */
function hasPushEnabled(member) {
  return Boolean(
      member &&
      member.preferences &&
      member.preferences.pushNotifications === true,
  );
}

/**
 * Reads every phone token a member has stored, one doc per phone, plus the
 * legacy single-token doc until its absence is recorded on the member.
 * Only for members with the
 * account preference on: the app sets it when any phone turns on and never
 * writes it false (off is per phone, by deleting that phone's doc), so false
 * is an opt-out from before per-phone tokens, and it skips the reads.
 * @param {Object} db Firestore database
 * @param {string} memberId Member document id
 * @param {Object} member Member Firestore document data
 * @return {Promise<Array<{token: string, refs: Array}>>} Distinct tokens
 */
async function getPushTokens(db, memberId, member) {
  if (!hasPushEnabled(member)) return [];

  const legacyRef = db.collection("push_tokens").doc(memberId);
  const [deviceDocs, legacyDoc] = await Promise.all([
    legacyRef.collection("devices").get(),
    member.pushTokensMigrated ? null : legacyRef.get(),
  ]);

  const entries = deviceDocs.docs.map((deviceDoc) => ({
    token: deviceDoc.get("token"),
    ref: deviceDoc.ref,
  }));
  if (legacyDoc && legacyDoc.exists) {
    entries.push({token: legacyDoc.get("token"), ref: legacyRef});
  }
  if (!member.pushTokensMigrated && !legacyDoc.exists) {
    // Bookkeeping is best effort: never reject the recipients' send batch.
    // Await the caught write so the Functions runtime cannot suspend it early.
    await db.collection("members").doc(memberId).update({
      pushTokensMigrated: true,
    }).catch((error) => {
      console.warn("Unable to mark push-token migration:", memberId, error);
    });
  }
  return groupTokenEntries(entries);
}


module.exports = {groupTokenEntries, decideMemberMarkers, getPushTokens};
