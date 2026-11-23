// CommonJS mirror of src/utils/hubClosures.js. The client is ESM and functions
// are CommonJS, so the closure list cannot be shared as one module — it is
// pinned in both places and the two must be edited together, like REGION.
//
// These checks are advisory in the same sense as checkBookingConflicts:
// firestore.rules does not enforce closures, so the booking calendar remains
// the primary guard.

const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";
// Vietnam has no DST, so hub time is always UTC+7.
const HUB_UTC_OFFSET_HOURS = 7;

const HUB_CLOSURES = [
  {
    id: "independence-day-2026",
    start: "2026-08-31",
    end: "2026-09-02",
    label: "Independence Day holiday",
  },
  {
    id: "culture-day-2026",
    start: "2026-11-24",
    end: "2026-11-24",
    label: "Vietnamese Culture Day holiday",
  },
  // Keep in step with src/utils/hubClosures.js (sources noted there).
  {
    id: "new-year-2027",
    start: "2027-01-01",
    end: "2027-01-01",
    label: "New Year holiday",
  },
  {
    id: "lunar-new-year-2027",
    start: "2027-02-04",
    end: "2027-02-10",
    label: "Lunar New Year (Tet) holiday",
  },
  {
    id: "hung-kings-2027",
    start: "2027-04-16",
    end: "2027-04-16",
    label: "Hung Kings Commemoration holiday",
  },
  {
    id: "reunification-day-2027",
    start: "2027-04-30",
    end: "2027-04-30",
    label: "Reunification Day holiday",
  },
  {
    id: "labour-day-2027",
    start: "2027-05-01",
    end: "2027-05-01",
    label: "Labour Day holiday",
  },
  {
    id: "labour-day-2027-in-lieu",
    start: "2027-05-03",
    end: "2027-05-03",
    label: "Labour Day holiday (day in lieu)",
  },
  {
    id: "martyrs-day-2027",
    start: "2027-07-27",
    end: "2027-07-27",
    label: "Invalids and Martyrs Day holiday",
  },
  {
    id: "national-day-2027",
    start: "2027-09-02",
    end: "2027-09-03",
    label: "National Day holiday",
  },
  {
    id: "culture-day-2027",
    start: "2027-11-24",
    end: "2027-11-24",
    label: "Vietnamese Culture Day holiday",
  },
  {
    id: "new-year-2028",
    start: "2028-01-01",
    end: "2028-01-01",
    label: "New Year holiday",
  },
  {
    id: "new-year-2028-in-lieu",
    start: "2028-01-03",
    end: "2028-01-03",
    label: "New Year holiday (day in lieu)",
  },
  {
    id: "hung-kings-2028",
    start: "2028-04-04",
    end: "2028-04-04",
    label: "Hung Kings Commemoration holiday",
  },
  {
    id: "reunification-labour-day-2028",
    start: "2028-04-30",
    end: "2028-05-02",
    label: "Reunification Day and Labour Day holiday",
  },
  {
    id: "martyrs-day-2028",
    start: "2028-07-27",
    end: "2028-07-27",
    label: "Invalids and Martyrs Day holiday",
  },
  {
    id: "culture-day-2028",
    start: "2028-11-24",
    end: "2028-11-24",
    label: "Vietnamese Culture Day holiday",
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

module.exports = {
  HUB_CLOSURES,
  HUB_UTC_OFFSET_HOURS,
  getHubClosure,
  rangeOverlapsClosure,
};
