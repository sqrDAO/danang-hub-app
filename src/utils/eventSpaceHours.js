// Event Hall hours for events. Kept free of Firebase imports so the rules can be
// unit-tested. Extensions are required: tests load this through Node's ESM.
import { getHubDayOfWeek, parseHubDateTime, toDatetimeLocalHub } from './timezone.js'
import { rangeOverlapsClosure } from './hubClosures.js'

// Event spaces: after 6 PM on weekdays, 9 AM–10 PM on weekends
export const EVENT_SPACE_AVAILABILITY = {
  isAvailable: true,
  startHour: 9,          // Weekend start: 9 AM
  weekdayStartHour: 18,  // Weekday start: 6 PM (after office hours)
  endHour: 22,           // All days end: 10 PM
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  slotDuration: 60,
  timezone: 'Asia/Ho_Chi_Minh'
}

// Fractional hour-of-day on the hub clock, e.g. 18:30 -> 18.5
const getHubHourOfDay = (date) => {
  const timePart = toDatetimeLocalHub(date).split('T')[1] || '00:00'
  const [hours, minutes] = timePart.split(':').map(Number)
  return hours + minutes / 60
}

const asHour = (value, fallback) => (typeof value === 'number' ? value : fallback)

// A venue's own settings can only narrow the policy window, never widen it.
// The admin form stores one `startHour`, which applies to weekends; weekdays
// keep the after-office-hours start.
const getVenueWindow = (amenity, isWeekend) => {
  const policyStart = isWeekend ? EVENT_SPACE_AVAILABILITY.startHour : EVENT_SPACE_AVAILABILITY.weekdayStartHour
  const venueStart = isWeekend ? amenity?.startHour : amenity?.weekdayStartHour
  return {
    policyStart,
    start: Math.max(policyStart, asHour(venueStart, policyStart)),
    end: Math.min(EVENT_SPACE_AVAILABILITY.endHour, asHour(amenity?.endHour, EVENT_SPACE_AVAILABILITY.endHour))
  }
}

const getPolicyHoursError = (window, startHour, endHour, isWeekend) => {
  if (startHour < window.policyStart) {
    return { key: isWeekend ? 'memberEvents.modal.weekendHoursError' : 'memberEvents.modal.weekdayHoursError' }
  }
  if (endHour > EVENT_SPACE_AVAILABILITY.endHour) return { key: 'memberEvents.modal.endTimeError' }
  return null
}

const getHoursError = (amenity, startHour, endHour, isWeekend) => {
  const window = getVenueWindow(amenity, isWeekend)
  const policyError = getPolicyHoursError(window, startHour, endHour, isWeekend)
  if (policyError) return policyError
  if (startHour < window.start || endHour > window.end) {
    return { key: 'memberEvents.modal.venueHoursError', params: { start: window.start, end: window.end } }
  }
  return null
}

const getVenueDayError = (amenity, dayOfWeek) => {
  if (amenity?.isAvailable === false) return { key: 'memberEvents.modal.venueUnavailableError' }
  const availableDays = Array.isArray(amenity?.availableDays) ? amenity.availableDays : EVENT_SPACE_AVAILABILITY.availableDays
  return availableDays.includes(dayOfWeek) ? null : { key: 'memberEvents.modal.venueDayError' }
}

// `{ key, params }` for the first rule the event breaks, or null when it fits.
// `amenity` is the selected venue; without one only the Hub-wide policy applies.
export const validateEventSpaceTime = (dateValue, durationMinutes = 60, amenity = null) => {
  if (!dateValue) return null
  const date = parseHubDateTime(dateValue)
  if (Number.isNaN(date.getTime())) return null

  const end = new Date(date.getTime() + durationMinutes * 60 * 1000)
  // A Hub closure outranks the hour rules: no start time on that day is valid.
  if (rangeOverlapsClosure(date, end)) return { key: 'memberEvents.modal.hubClosedError' }

  const dayOfWeek = getHubDayOfWeek(date)
  const dayError = getVenueDayError(amenity, dayOfWeek)
  if (dayError) return dayError

  const startHour = getHubHourOfDay(date)
  return getHoursError(amenity, startHour, startHour + durationMinutes / 60, dayOfWeek === 0 || dayOfWeek === 6)
}
