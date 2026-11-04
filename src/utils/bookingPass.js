import { formatHubDate, isSameHubDay } from './timezone.js'

const INACTIVE_STATUSES = ['cancelled', 'rejected']

// Firestore rules don't require the times, and Intl throws on an Invalid Date,
// so every hub-day or format call checks this first.
const isValidTime = (time) => time != null && !Number.isNaN(new Date(time).getTime())
export const hasBookingTimes = (booking) => isValidTime(booking.startTime) && isValidTime(booking.endTime)

export const isPassStatus = (status) => ['approved', 'checked-in'].includes(status)

// The guard pass is a glance aid, not access control (anyone can fake a
// screenshot), so the rule stays loose: no endTime check, no server refetch.
export const canShowPass = (booking, now = new Date()) =>
  isPassStatus(booking.status) && hasBookingTimes(booking) && isSameHubDay(booking.startTime, now)

const sameSlot = (a, b) =>
  a.amenityId === b.amenityId &&
  String(a.startTime) === String(b.startTime) &&
  String(a.endTime) === String(b.endTime)

// One booking per amenity + slot. An active booking wins over a cancelled or
// rejected one in the same slot (a member can cancel and re-book the same
// slot); otherwise the first one wins.
export const deduplicateBookings = (bookings) => {
  const rank = (booking) => (INACTIVE_STATUSES.includes(booking.status) ? 1 : 0)
  return bookings.filter((booking, index) => !bookings.some((other, otherIndex) =>
    otherIndex !== index && sameSlot(other, booking) &&
    (rank(other) < rank(booking) || (rank(other) === rank(booking) && otherIndex < index))))
}

// Today keeps every active booking of the hub day for the whole day; the rest
// split on start time as before. Bookings without valid times go to Past.
export const splitBookings = (bookings, now = new Date()) => {
  const groups = { today: [], upcoming: [], past: [] }
  for (const booking of bookings) {
    const timed = hasBookingTimes(booking)
    const active = !INACTIVE_STATUSES.includes(booking.status)
    if (timed && active && isSameHubDay(booking.startTime, now)) groups.today.push(booking)
    else if (timed && new Date(booking.startTime) > now) groups.upcoming.push(booking)
    else groups.past.push(booking)
  }
  return groups
}

// 24h HH:mm reads the same in both languages, so the card and the pass share
// one string (h23: never "24:00").
export const formatHubTimeRange = (booking) => {
  const time = (date) => formatHubDate(date, 'vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${time(booking.startTime)} – ${time(booking.endTime)}`
}

// "9h", "1h30": no decimal separator to localise.
export const formatDurationShort = (startTime, endTime) => {
  const minutes = Math.round((new Date(endTime) - new Date(startTime)) / 60000)
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)}h${rest ? String(rest).padStart(2, '0') : ''}`
}
