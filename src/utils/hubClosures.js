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

/**
 * Closures that have not finished yet, soonest first — what a member still
 * needs to plan around.
 * @param {Date|string|number} [from]
 * @returns {Array<object>}
 */
export const getUpcomingHubClosures = (from = new Date()) => {
  const today = toHubDay(from) ?? toDateInputHub(new Date())
  return HUB_CLOSURES
    .filter(closure => closure.end >= today)
    .sort((first, second) => first.start.localeCompare(second.start))
}
