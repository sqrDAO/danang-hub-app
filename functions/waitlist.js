// Pure waitlist logic, kept out of index.js so it can be unit-tested without
// initializing firebase-admin. Mirrors the split eventLifecycle.js uses.

/**
 * Returns the uids an event write moved from `waitlist` into `attendees`.
 *
 * A real promotion moves a uid from `waitlist` into `attendees` in the SAME
 * write. Requiring removal from `after.waitlist` (not just prior membership in
 * `before.waitlist`) matters because firestore.rules only restricts which
 * *fields* a member write may touch, not which uid or by whom — a bare
 * `attendees`-only registerForEvent write naming a uid still sitting in
 * `waitlist` would otherwise pass this diff and fire a spoofed promotion
 * notification at an arbitrary member.
 *
 * @param {Object} before Event document data before the write
 * @param {Object} after Event document data after the write
 * @return {Array<string>} Newly promoted member uids
 */
const getNewlyPromoted = (before, after) => {
  const beforeAttendeeSet = new Set(before.attendees || []);
  const beforeWaitlistSet = new Set(before.waitlist || []);
  const afterWaitlistSet = new Set(after.waitlist || []);
  return (after.attendees || []).filter((uid) =>
    !beforeAttendeeSet.has(uid) &&
    beforeWaitlistSet.has(uid) &&
    !afterWaitlistSet.has(uid),
  );
};

module.exports = {getNewlyPromoted};
