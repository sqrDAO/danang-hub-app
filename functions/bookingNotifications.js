// Pure decision logic for booking notifications, kept out of index.js so it can
// be unit-tested without initializing firebase-admin. Mirrors the split that
// eventLifecycle.js already uses.

// Statuses a booking can be cancelled *from*. A booking that was already
// cancelled or completed is not "cancelled on the member" a second time.
const ACTIVE_BOOKING_STATUSES = ["pending", "approved", "checked-in"];

// Reasons written by the Hub-closure tooling. Matched by prefix so a future
// closure ("hub-closure-tet-2027") gets the same wording without a code change.
const HUB_CLOSURE_REASON_PREFIX = "hub-closure";

/**
 * Decides whether a booking write means "someone else cancelled this member's
 * booking", and what the notification should say.
 *
 * `cancelledReason` is the actor signal: the member-facing cancel path never
 * sets it, and firestore.rules forbids owners from writing it, so its presence
 * means the cancellation came from an admin, a script, or a callable. Returning
 * null is the "stay silent" answer — notably for a member cancelling their own
 * booking, who does not need telling what they just did.
 *
 * @param {Object} before Booking document data before the write
 * @param {Object} after Booking document data after the write
 * @return {{reason: string, isHubClosure: boolean, isFixedDesk: boolean}|null}
 */
function getCancellationNotice(before, after) {
  if (!before || !after) return null;
  if (after.status !== "cancelled") return null;
  if (before.status === after.status) return null;
  if (!ACTIVE_BOOKING_STATUSES.includes(before.status)) return null;

  const raw = after.cancelledReason;
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (!reason) return null;

  return {
    reason,
    isHubClosure: reason.startsWith(HUB_CLOSURE_REASON_PREFIX),
    isFixedDesk: after.planType === "fixed-desk",
  };
}

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  HUB_CLOSURE_REASON_PREFIX,
  getCancellationNotice,
};
