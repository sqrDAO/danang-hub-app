/**
 * Date planning for recurring bookings and fixed desk plans, on the hub
 * calendar. Pure: no Firestore, so `test/recurrence.test.js` can run it under
 * any TZ. Extension is required: Node's ESM test runner loads this file.
 */
import {
  addHubDays,
  addHubMonths,
  getHubDayOfWeek,
  makeHubDateAtTime,
  parseHubDateTime,
} from './timezone.js'

const DAY_MS = 24 * 60 * 60 * 1000
const STEP_DAYS = { daily: 1, weekly: 7 }
// Same ceiling as before when neither an end date nor a count is given.
const MAX_OCCURRENCES = 999
// Stops a filter that rejects every day (e.g. allowedWeekdays: []) from looping forever.
const MAX_STEPS = 10000
const FRIDAY = 5

export const DESK_START_HOUR = 9
export const DESK_END_HOUR = 18

// The nth candidate start. Daily/weekly are exact 24h multiples (the hub has no
// DST, so the hub wall time holds). Monthly counts from the original start, so
// a Jan 31 series goes Feb 28 → Mar 31 rather than drifting to Mar 28.
const nthRecurrence = (start, frequency, n) => {
  if (frequency === 'monthly') return addHubMonths(start, n)
  const stepDays = STEP_DAYS[frequency]
  if (!stepDays) throw new Error(`Unknown recurrence frequency: ${frequency}`)
  return new Date(start.getTime() + n * stepDays * DAY_MS)
}

const isAllowedHubWeekday = (allowedWeekdays, date) =>
  !allowedWeekdays || allowedWeekdays.includes(getHubDayOfWeek(date))

// First instant after the end date's hub day, so the end date is inclusive.
// A bare "YYYY-MM-DD" is read as that hub day, not as UTC midnight.
const getEndBound = (endDate) => (endDate ? addHubDays(parseHubDateTime(endDate), 1) : null)

/**
 * Start instants for a recurring booking.
 * `occurrences` counts only allowed, open days, so a skipped day does not use one up.
 * @param {{ start: Date|string, frequency: 'daily'|'weekly'|'monthly',
 *   endDate?: Date|string|null, occurrences?: number|null,
 *   allowedWeekdays?: number[]|null, isOpen?: (date: Date) => boolean }} params
 * @returns {Date[]}
 */
export const planRecurrenceStarts = ({
  start,
  frequency,
  endDate = null,
  occurrences = null,
  allowedWeekdays = null,
  isOpen = () => true,
}) => {
  const first = new Date(start)
  const endBound = getEndBound(endDate)
  const maxOccurrences = occurrences || MAX_OCCURRENCES
  const starts = []
  for (let n = 0; starts.length < maxOccurrences && n < MAX_STEPS; n++) {
    const candidate = nthRecurrence(first, frequency, n)
    if (endBound && candidate >= endBound) break
    if (isAllowedHubWeekday(allowedWeekdays, candidate) && isOpen(candidate)) starts.push(candidate)
  }
  return starts
}

// Days from a hub weekday to the next Friday; Saturday rolls to next week's.
const daysUntilFriday = (weekday) => (weekday === 0 ? FRIDAY : (FRIDAY - weekday + 7) % 7)

/**
 * The 09:00–18:00 hub-time window of a fixed desk plan.
 * @param {{ startDate: string, period: 'weekly'|'monthly' }} params
 *   startDate is a "YYYY-MM-DD" date-input value, read as a hub calendar day.
 * @returns {{ start: Date, firstDayEnd: Date, end: Date }} start and end of the
 *   first day, and 18:00 on the last day (that week's Friday, or a month less a day).
 */
export const getFixedDeskPlanWindow = ({ startDate, period }) => {
  const start = makeHubDateAtTime(parseHubDateTime(startDate), DESK_START_HOUR, 0)
  const lastDay = period === 'weekly'
    ? addHubDays(start, daysUntilFriday(getHubDayOfWeek(start)))
    : addHubDays(addHubMonths(start, 1), -1)
  return {
    start,
    firstDayEnd: makeHubDateAtTime(start, DESK_END_HOUR, 0),
    end: makeHubDateAtTime(lastDay, DESK_END_HOUR, 0),
  }
}
