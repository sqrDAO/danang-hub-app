// Full-day Hub closures (public holidays, maintenance shutdowns).
//
// Amenity availability is weekday + hour based, which cannot express "the Hub
// is shut on these specific dates". This list is that missing layer: every
// entry closes whole hub calendar days, inclusive of both endpoints, for every
// amenity and for events.
//
// Pinned in two places — `functions/hubClosures.js` is the CommonJS mirror the
// callables read. The client is ESM and functions are CommonJS, so they cannot
// share a module; they must be edited together, like `REGION`.
//
// Extension is required: test/hubClosures.test.js loads this through Node's ESM
// loader, which does not resolve extensionless specifiers the way Vite does.
import { toDateInputHub } from './timezone.js'

export const HUB_CLOSURES = [
  {
    id: 'independence-day-2026',
    start: '2026-08-31',
    end: '2026-09-02',
    labelKey: 'closures.independenceDay2026',
  },
  {
    id: 'culture-day-2026',
    start: '2026-11-24',
    end: '2026-11-24',
    labelKey: 'closures.cultureDay2026',
  },
  // 2027: MoHA notice 11483/TB-BNV (Tet, National Day) and Labor Code art. 112
  // as amended 21 Nov 2026 (adds 27/7 and 24/11); weekend holidays get the
  // next working day in lieu. 2028: only dates fixed by law. Add 2028 Tet and
  // National Day once the official schedule is announced (usually Q4 2027).
  {
    id: 'new-year-2027',
    start: '2027-01-01',
    end: '2027-01-01',
    labelKey: 'closures.newYear',
  },
  {
    id: 'lunar-new-year-2027',
    start: '2027-02-04',
    end: '2027-02-10',
    labelKey: 'closures.lunarNewYear',
  },
  {
    id: 'hung-kings-2027',
    start: '2027-04-16',
    end: '2027-04-16',
    labelKey: 'closures.hungKings',
  },
  {
    id: 'reunification-day-2027',
    start: '2027-04-30',
    end: '2027-04-30',
    labelKey: 'closures.reunificationDay',
  },
  {
    id: 'labour-day-2027',
    start: '2027-05-01',
    end: '2027-05-01',
    labelKey: 'closures.labourDay',
  },
  {
    id: 'labour-day-2027-in-lieu',
    start: '2027-05-03',
    end: '2027-05-03',
    labelKey: 'closures.labourDayInLieu',
  },
  {
    id: 'martyrs-day-2027',
    start: '2027-07-27',
    end: '2027-07-27',
    labelKey: 'closures.martyrsDay',
  },
  {
    id: 'national-day-2027',
    start: '2027-09-02',
    end: '2027-09-03',
    labelKey: 'closures.nationalDay',
  },
  {
    id: 'culture-day-2027',
    start: '2027-11-24',
    end: '2027-11-24',
    labelKey: 'closures.cultureDay',
  },
  {
    id: 'new-year-2028',
    start: '2028-01-01',
    end: '2028-01-01',
    labelKey: 'closures.newYear',
  },
  {
    id: 'new-year-2028-in-lieu',
    start: '2028-01-03',
    end: '2028-01-03',
    labelKey: 'closures.newYearInLieu',
  },
  {
    id: 'hung-kings-2028',
    start: '2028-04-04',
    end: '2028-04-04',
    labelKey: 'closures.hungKings',
  },
  {
    id: 'reunification-labour-day-2028',
    start: '2028-04-30',
    end: '2028-05-02',
    labelKey: 'closures.reunificationLabourDay',
  },
  {
    id: 'martyrs-day-2028',
    start: '2028-07-27',
    end: '2028-07-27',
    labelKey: 'closures.martyrsDay',
  },
  {
    id: 'culture-day-2028',
    start: '2028-11-24',
    end: '2028-11-24',
    labelKey: 'closures.cultureDay',
  },
]

const HUB_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// Closure bounds are plain "YYYY-MM-DD" hub days, so every comparison below is
// a lexicographic string compare — no instant ever crosses a timezone twice.
const toHubDay = (value) => {
  if (typeof value === 'string' && HUB_DAY_PATTERN.test(value)) return value
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : toDateInputHub(date)
}

/**
 * The closure covering a date's hub calendar day, or null when the Hub is open.
 * @param {Date|string|number} date
 * @returns {{id: string, start: string, end: string, labelKey: string}|null}
 */
export const getHubClosure = (date) => {
  const day = toHubDay(date)
  if (!day) return null
  return HUB_CLOSURES.find(closure => day >= closure.start && day <= closure.end) ?? null
}

/**
 * Whether the Hub is closed for a date's whole hub calendar day.
 * @param {Date|string|number} date
 * @returns {boolean}
 */
export const isHubClosed = (date) => getHubClosure(date) !== null

/**
 * The closure a [start, end] span touches, or null. Bookings are same-day by
 * rule, but an admin-assigned or legacy span could straddle a closure edge, and
 * touching one closed day is enough to block the whole booking.
 * @param {Date|string|number} start
 * @param {Date|string|number} [end]
 * @returns {object|null}
 */
export const rangeOverlapsClosure = (start, end) => {
  const startDay = toHubDay(start)
  const endDay = toHubDay(end ?? start) ?? startDay
  if (!startDay) return null
  const [from, to] = startDay <= endDay ? [startDay, endDay] : [endDay, startDay]
  return HUB_CLOSURES.find(closure => closure.start <= to && closure.end >= from) ?? null
}

// Hub days are plain calendar dates, so day arithmetic in UTC is exact.
const addHubDays = (day, days) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

/**
 * Closures that have not finished yet, soonest first — what a member still
 * needs to plan around. `withinDays` keeps only those starting that soon, so
 * a long list of future holidays does not crowd the member notice.
 * @param {Date|string|number} [from]
 * @param {{withinDays?: number}} [options]
 * @returns {Array<object>}
 */
export const getUpcomingHubClosures = (from = new Date(), { withinDays } = {}) => {
  const today = toHubDay(from) ?? toDateInputHub(new Date())
  const horizon = withinDays === undefined ? null : addHubDays(today, withinDays)
  return HUB_CLOSURES
    .filter(closure => closure.end >= today && (!horizon || closure.start <= horizon))
    .sort((first, second) => first.start.localeCompare(second.start))
}
