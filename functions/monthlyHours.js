// Pure logic for the 40-hour monthly limit on coworking desk bookings
// (issue #112), kept out of index.js so it can be unit-tested without
// firebase-admin. Mirrored for the booking page in src/utils/monthlyHours.js;
// the two must be edited together.
//
// Counted: bookings on a desk amenity that are not part of a desk plan
// (Fixed Desk and Partner Desk days are separate products), while pending,
// approved, checked-in or completed. Hours are split by hub calendar month.

const {HUB_UTC_OFFSET_HOURS} = require("./hubClosures");

const MONTHLY_DESK_HOURS = 40;
const MONTHLY_HOURS_LIMIT_REASON = "monthly-hours-limit";
const COUNTED_STATUSES = ["pending", "approved", "checked-in", "completed"];
const DESK_PLAN_TYPES = ["fixed-desk", "partner-desk"];
const HOUR_MS = 60 * 60 * 1000;
const OFFSET_MS = HUB_UTC_OFFSET_HOURS * HOUR_MS;

/**
 * @param {*} value Firestore Timestamp or date-like value
 * @return {number} Epoch ms
 */
function toMs(value) {
  return value && typeof value.toDate === "function" ?
    value.toDate().getTime() : new Date(value).getTime();
}

/**
 * @param {number} ms Epoch ms
 * @return {string} Hub calendar month, "YYYY-MM"
 */
function hubMonthKey(ms) {
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 7);
}

/**
 * Start of the hub month after the one containing ms.
 * @param {number} ms Epoch ms
 * @return {number} Epoch ms
 */
function nextHubMonthStart(ms) {
  const hub = new Date(ms + OFFSET_MS);
  return Date.UTC(hub.getUTCFullYear(), hub.getUTCMonth() + 1, 1) - OFFSET_MS;
}

/**
 * The span of hub months a range touches, padded by a day before so a
 * booking starting the evening before a month counts: [from, to) epoch ms.
 * @param {*} startTime Range start
 * @param {*} endTime Range end
 * @return {{from: number, to: number}}
 */
function monthWindow(startTime, endTime) {
  const start = toMs(startTime);
  const hub = new Date(start + OFFSET_MS);
  const monthStart =
    Date.UTC(hub.getUTCFullYear(), hub.getUTCMonth(), 1) - OFFSET_MS;
  return {
    from: monthStart - 24 * HOUR_MS,
    to: nextHubMonthStart(toMs(endTime)),
  };
}

/**
 * Whether a booking uses up monthly desk hours.
 * @param {Object} booking Booking data
 * @param {Map<string, Object>} amenities id -> amenity
 * @return {boolean}
 */
function countsTowardLimit(booking, amenities) {
  const amenity = amenities.get(booking.amenityId);
  return Boolean(amenity) && amenity.type === "desk" &&
    !DESK_PLAN_TYPES.includes(booking.planType) &&
    COUNTED_STATUSES.includes(booking.status);
}

/**
 * Hours of a time range in each hub month it touches.
 * @param {*} startTime Range start
 * @param {*} endTime Range end
 * @return {Map<string, number>} "YYYY-MM" -> hours
 */
function hoursByMonth(startTime, endTime) {
  const hours = new Map();
  const end = toMs(endTime);
  let cursor = toMs(startTime);
  while (cursor < end) {
    const sliceEnd = Math.min(end, nextHubMonthStart(cursor));
    const key = hubMonthKey(cursor);
    hours.set(key, (hours.get(key) || 0) + (sliceEnd - cursor) / HOUR_MS);
    cursor = sliceEnd;
  }
  return hours;
}

/**
 * Whether `other` was written before `booking`. Bookings made at nearly the
 * same moment each see the other still pending; ordering them lets the
 * earlier one keep its hours, so the later one alone is judged against them
 * instead of both being cancelled. Ties break on id.
 * @param {Object} other Another booking, with id and createMs
 * @param {Object} booking The booking being judged, with id and createMs
 * @return {boolean}
 */
function writtenBefore(other, booking) {
  if (typeof other.createMs !== "number" ||
      typeof booking.createMs !== "number") {
    return true;
  }
  if (other.createMs !== booking.createMs) {
    return other.createMs < booking.createMs;
  }
  return other.id < booking.id;
}

/**
 * Desk hours a member has used in each month, from their bookings.
 * @param {Array<Object>} bookings The member's bookings, with ids
 * @param {Map<string, Object>} amenities id -> amenity
 * @param {Object} [judged] The booking being judged: it and anything
 *   written after it are left out
 * @return {Map<string, number>} "YYYY-MM" -> hours
 */
function usageByMonth(bookings, amenities, judged) {
  const usage = new Map();
  bookings.forEach((b) => {
    if (judged && (b.id === judged.id || !writtenBefore(b, judged))) return;
    if (!countsTowardLimit(b, amenities)) return;
    hoursByMonth(b.startTime, b.endTime).forEach((h, key) => {
      usage.set(key, (usage.get(key) || 0) + h);
    });
  });
  return usage;
}

/**
 * The first month a new booking would take over the limit, given the
 * member's other bookings; null when it fits.
 * @param {Object} booking The new booking, with id and createMs (its
 *   Firestore create time, epoch ms)
 * @param {Array<Object>} memberBookings The member's bookings around it,
 *   each with id and createMs
 * @param {Map<string, Object>} amenities id -> amenity
 * @return {?{month: string, hoursLeft: number}}
 */
function monthOverLimit(booking, memberBookings, amenities) {
  if (!countsTowardLimit(booking, amenities)) return null;
  const usage = usageByMonth(memberBookings, amenities, booking);
  for (const [month, hours] of hoursByMonth(booking.startTime,
      booking.endTime)) {
    const used = usage.get(month) || 0;
    // Small epsilon: 40 bookings of exactly one hour must not trip on
    // floating-point sums.
    if (used + hours > MONTHLY_DESK_HOURS + 1e-9) {
      return {month, hoursLeft: Math.max(0, MONTHLY_DESK_HOURS - used)};
    }
  }
  return null;
}

module.exports = {
  MONTHLY_DESK_HOURS,
  MONTHLY_HOURS_LIMIT_REASON,
  countsTowardLimit,
  hoursByMonth,
  hubMonthKey,
  monthOverLimit,
  monthWindow,
  usageByMonth,
};
