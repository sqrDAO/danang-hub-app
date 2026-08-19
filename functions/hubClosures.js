// CommonJS mirror of src/utils/hubClosures.js. The client is ESM and functions
// are CommonJS, so the closure list cannot be shared as one module — it is
// pinned in both places and the two must be edited together, like REGION.
//
// These checks are advisory in the same sense as checkBookingConflicts:
// firestore.rules does not enforce closures, so the booking calendar remains
// the primary guard.

const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";

const HUB_CLOSURES = [
  {
    id: "independence-day-2026",
    start: "2026-08-31",
    end: "2026-09-02",
    label: "Independence Day holiday",
  },
];

const HUB_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: HUB_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Normalizes a date-like value to its "YYYY-MM-DD" hub calendar day.
 * @param {Date|string|number} value
 * @return {string|null} Hub day, or null when the value is unreadable
 */
function toHubDay(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : HUB_DAY_FORMATTER.format(date);
}

/**
 * The closure covering a date's hub calendar day, or null when open.
 * @param {Date|string|number} date
 * @return {object|null}
 */
function getHubClosure(date) {
  const day = toHubDay(date);
  if (!day) return null;
  return HUB_CLOSURES.find(
      (closure) => day >= closure.start && day <= closure.end) || null;
}

/**
 * The closure a [start, end] span touches, or null.
 * @param {Date|string|number} start
 * @param {Date|string|number} [end]
 * @return {object|null}
 */
function rangeOverlapsClosure(start, end) {
  const startDay = toHubDay(start);
  if (!startDay) return null;
  const endDay = toHubDay(end === undefined ? start : end) || startDay;
  const from = startDay <= endDay ? startDay : endDay;
  const to = startDay <= endDay ? endDay : startDay;
  return HUB_CLOSURES.find(
      (closure) => closure.start <= to && closure.end >= from) || null;
}

module.exports = {HUB_CLOSURES, getHubClosure, rangeOverlapsClosure};
