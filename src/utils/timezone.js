/**
 * Hub timezone utilities. All event and booking times are in Asia/Ho_Chi_Minh.
 * datetime-local inputs use local time strings - we treat them as Vietnam time.
 */

export const HUB_TIMEZONE = 'Asia/Ho_Chi_Minh'

/**
 * Parse "YYYY-MM-DDTHH:mm" (from datetime-local) as Vietnam time.
 * Returns a Date (UTC internally) representing that moment.
 * @param {string} localStr - e.g. "2025-03-07T14:00"
 * @returns {Date}
 */
export function parseHubDateTime(localStr) {
  if (!localStr || typeof localStr !== 'string') return new Date(localStr)
  // A UTC marker or offset only ever appears at the very end of the string. The
  // test must be anchored: an unanchored /[+-]\d{2}/ also matches the hyphens
  // inside "YYYY-MM-DD", which silently sent every value down this branch and
  // parsed it as browser-local time instead of hub time.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(localStr)) {
    return new Date(localStr)
  }
  if (!localStr.includes('T')) return new Date(`${localStr}T00:00:00+07:00`)
  const withSeconds = /T\d{2}:\d{2}$/.test(localStr) ? `${localStr}:00` : localStr
  return new Date(`${withSeconds}+07:00`)
}

/**
 * Format a Date for display in hub timezone (date + time).
 * @param {Date|string} date
 * @param {{ dateStyle?: string, timeStyle?: string }} options
 * @returns {string}
 */
export function formatEventDateTime(date, options = {}) {
  if (!date) return 'N/A'
  const d = date instanceof Date ? date : new Date(date)
  const { locale = 'en-US', ...restOptions } = options
  return d.toLocaleString(locale, {
    timeZone: HUB_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...restOptions
  })
}

/**
 * Format a date as dd/mm/yyyy in hub timezone.
 */
export function formatDateDDMMYYYY(date) {
  if (!date) return 'N/A'
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('en-GB', {
    timeZone: HUB_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Format date only for display in hub timezone.
 */
export function formatEventDate(date) {
  return formatDateDDMMYYYY(date)
}

/**
 * Format time only for display in hub timezone.
 */
export function formatEventTime(date) {
  if (!date) return 'N/A'
  const d = date instanceof Date ? date : new Date(date)
  const locale = 'en-US'
  return d.toLocaleTimeString(locale, {
    timeZone: HUB_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Compact date+time for list rows (e.g. notification panel) in hub timezone.
 * Returns empty string when the value is missing or invalid.
 * @param {Date|string|number|null|undefined} date
 * @param {string} [locale='en-US']
 * @returns {string}
 */
export function formatHubDateTimeCompact(date, locale = 'en-US') {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale, {
    timeZone: HUB_TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Convert a Date to "YYYY-MM-DDTHH:mm" for datetime-local input (Vietnam timezone).
 * @param {Date|string} date
 * @returns {string}
 */
export function toDatetimeLocalHub(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/**
 * Convert a Date to "YYYY-MM-DD" for date inputs in the hub timezone.
 * @param {Date|string} date
 * @returns {string}
 */
export function toDateInputHub(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Hub calendar-day helpers.
 *
 * Everything below treats a Date as a point on the hub calendar rather than on
 * the browser's. Asia/Ho_Chi_Minh is a fixed +07:00 offset with no DST, so once
 * an instant is snapped to hub midnight, day arithmetic is exact 24h math.
 */
const HUB_DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad2 = (value) => String(value).padStart(2, '0')

/**
 * Snap a Date to 00:00 of its hub calendar day.
 * @param {Date|string} [date]
 * @returns {Date}
 */
export function getHubStartOfDay(date = new Date()) {
  return parseHubDateTime(toDateInputHub(date))
}

/**
 * 00:00 of the current hub calendar day.
 * @returns {Date}
 */
export function getHubStartOfToday() {
  return getHubStartOfDay(new Date())
}

/**
 * Shift a date by whole hub calendar days, returning that day's hub midnight.
 * @param {Date|string} date
 * @param {number} days
 * @returns {Date}
 */
export function addHubDays(date, days) {
  return new Date(getHubStartOfDay(date).getTime() + days * HUB_DAY_MS)
}

/**
 * Day of week (0 = Sunday) of a date's hub calendar day.
 * @param {Date|string} date
 * @returns {number}
 */
export function getHubDayOfWeek(date) {
  const d = date instanceof Date ? date : new Date(date)
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: HUB_TIMEZONE,
    weekday: 'short',
  }).format(d)
  return WEEKDAY_NAMES.indexOf(weekday)
}

/**
 * Day of month of a date's hub calendar day.
 * @param {Date|string} date
 * @returns {number}
 */
export function getHubDayOfMonth(date) {
  return Number(toDateInputHub(date).slice(8, 10))
}

/**
 * Whether two dates fall on the same hub calendar day.
 * @param {Date|string|number} first
 * @param {Date|string|number} second
 * @returns {boolean}
 */
export function isSameHubDay(first, second) {
  return toDateInputHub(new Date(first)) === toDateInputHub(new Date(second))
}

/**
 * The instant at hh:mm on a date's hub calendar day.
 * @param {Date|string} date
 * @param {number} hour
 * @param {number} minute
 * @returns {Date}
 */
export function makeHubDateAtTime(date, hour, minute) {
  return parseHubDateTime(`${toDateInputHub(date)}T${pad2(hour)}:${pad2(minute)}`)
}

/**
 * Format a date in the hub timezone, so the rendered day matches the hub day.
 * @param {Date|string} date
 * @param {string} locale
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatHubDate(date, locale, options = {}) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString(locale, { timeZone: HUB_TIMEZONE, ...options })
}
