// Pure Fixed Desk renewal logic, kept out of index.js so it can be
// unit-tested without firebase-admin.
//
// A renewal is a new fixed-desk plan whose days carry renewalOf: <the
// planGroupId it renews>. Its days start pending and wait for an admin, and
// while they wait they do not hold the desk: other members may book over
// them, and approval re-checks each day.

const ACTIVE_STATUSES = ["pending", "approved", "checked-in"];
const ENDING_SOON_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const RENEWAL_REJECTED_REASON = "renewal-rejected";
const RENEWAL_EXPIRED_REASON = "renewal-expired";

/**
 * @param {Object} booking Booking data
 * @return {boolean} Whether it is a renewal day still waiting for an admin
 */
function isPendingRenewal(booking) {
  return Boolean(booking) && booking.status === "pending" &&
    typeof booking.renewalOf === "string" && booking.renewalOf.length > 0;
}

/**
 * Whether a booking takes a seat for conflict checks and calendar ranges.
 * @param {Object} booking Booking data
 * @return {boolean}
 */
function holdsSeat(booking) {
  return ACTIVE_STATUSES.includes(booking.status) && !isPendingRenewal(booking);
}

const toMs = (value) => (value && typeof value.toDate === "function" ?
  value.toDate().getTime() : new Date(value).getTime());

/**
 * Approved Fixed Desk plans whose last day starts within ENDING_SOON_DAYS
 * hub days and that have no live renewal: the members to remind.
 * @param {Array<Object>} bookings Bookings starting today or later, any
 *   status, with ids
 * @param {number} startOfTodayMs Hub midnight today, epoch ms
 * @param {number} nowMs Current time, epoch ms
 * @return {Array<{planGroupId: string, memberId: string, amenityId: string,
 *   lastDayStart: number}>}
 */
function plansEndingSoon(bookings, startOfTodayMs, nowMs) {
  const renewed = new Set(bookings
      .filter((b) => b.renewalOf && b.status !== "cancelled")
      .map((b) => b.renewalOf));
  const lastDays = new Map();
  bookings.forEach((b) => {
    if (b.planType !== "fixed-desk" || !b.planGroupId) return;
    if (b.status === "cancelled") return;
    const current = lastDays.get(b.planGroupId);
    if (!current || toMs(b.startTime) > toMs(current.startTime)) {
      lastDays.set(b.planGroupId, b);
    }
  });
  const horizon = startOfTodayMs + (ENDING_SOON_DAYS + 1) * DAY_MS;
  const ending = [];
  lastDays.forEach((last, planGroupId) => {
    if (last.status !== "approved" || renewed.has(planGroupId)) return;
    const start = toMs(last.startTime);
    if (start >= horizon || toMs(last.endTime) <= nowMs) return;
    ending.push({
      planGroupId,
      memberId: last.memberId,
      amenityId: last.amenityId,
      lastDayStart: start,
    });
  });
  return ending;
}

module.exports = {
  ENDING_SOON_DAYS,
  RENEWAL_EXPIRED_REASON,
  RENEWAL_REJECTED_REASON,
  holdsSeat,
  isPendingRenewal,
  plansEndingSoon,
};
