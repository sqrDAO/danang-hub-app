// Pure decision logic for booking notifications, kept out of index.js so it can
// be unit-tested without initializing firebase-admin. Mirrors the split that
// eventLifecycle.js already uses.

// Statuses a booking can be cancelled *from*. A booking that was already
// cancelled or completed is not "cancelled on the member" a second time.
const ACTIVE_BOOKING_STATUSES = ["pending", "approved", "checked-in"];

// Reasons written by the Hub-closure tooling. Matched by prefix so a future
// closure ("hub-closure-tet-2027") gets the same wording without a code change.
const HUB_CLOSURE_REASON_PREFIX = "hub-closure";

// Desk plans: one booking per working day sharing a planGroupId. Members of a
// partner org (members.partnerId) get partner-desk plans; everyone else
// fixed-desk. Mirrors src/utils/deskPlans.js.
const DESK_PLAN_TYPES = ["fixed-desk", "partner-desk"];

/**
 * @param {string} planType Booking planType
 * @return {boolean} Whether the booking belongs to a desk plan
 */
function isDeskPlan(planType) {
  return DESK_PLAN_TYPES.includes(planType);
}

/**
 * How notification copy names a desk plan's desk ("fixed desk plan",
 * "gói bàn cố định").
 * @param {string} planType Booking planType
 * @return {{en: string, vi: string}} Desk name in each locale
 */
function deskPlanLabel(planType) {
  return planType === "partner-desk" ?
    {en: "partner desk", vi: "bàn đối tác"} :
    {en: "fixed desk", vi: "bàn cố định"};
}

// Cancellations the member is not told about, one by one:
// - partner-desk-moved: the Partner Desk sync moved them to their partner's
//   new desk in the same run, so nothing was lost;
// - renewal-expired / renewal-day-unavailable: single days of a Fixed Desk
//   renewal that lapsed unreviewed, or lost their seat when it was approved.
//   A renewal can drop many days; the approval or rejection is the one
//   message about it, and the plan card shows what is left.
const SILENT_CANCEL_REASONS = [
  "partner-desk-moved",
  "renewal-expired",
  "renewal-day-unavailable",
];

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
 * @return {?Object} null, or {reason, isHubClosure, isPlan, planType,
 *   isRenewalRejection, rejectionReason, limitHoursLeft, limitMonth}
 */
function getCancellationNotice(before, after) {
  if (!before || !after) return null;
  if (after.status !== "cancelled") return null;
  if (before.status === after.status) return null;
  if (!ACTIVE_BOOKING_STATUSES.includes(before.status)) return null;

  const raw = after.cancelledReason;
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (!reason) return null;
  if (SILENT_CANCEL_REASONS.includes(reason)) return null;

  return {
    reason,
    isHubClosure: reason.startsWith(HUB_CLOSURE_REASON_PREFIX),
    isPlan: isDeskPlan(after.planType),
    planType: after.planType || "standard",
    // A renewal that could not be approved because no day was left counts
    // as a rejection for the member: same message, no admin reason.
    isRenewalRejection: ["renewal-rejected", "renewal-unavailable"]
        .includes(reason),
    rejectionReason: typeof after.rejectionReason === "string" &&
      after.rejectionReason.trim() ? after.rejectionReason.trim() : null,
    limitHoursLeft: typeof after.limitHoursLeft === "number" ?
      after.limitHoursLeft : null,
    limitMonth: typeof after.limitMonth === "string" ? after.limitMonth : null,
  };
}

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  DESK_PLAN_TYPES,
  HUB_CLOSURE_REASON_PREFIX,
  deskPlanLabel,
  getCancellationNotice,
  isDeskPlan,
};
