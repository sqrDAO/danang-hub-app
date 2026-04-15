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
  if (localStr.includes('Z') || /[+-]\d{2}/.test(localStr)) {
    return new Date(localStr)
  }
  const withTz = localStr.includes('T') ? `${localStr}:00+07:00` : `${localStr}T00:00:00+07:00`
  return new Date(withTz)
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
