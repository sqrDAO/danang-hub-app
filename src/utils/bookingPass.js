import { isSameHubDay } from './timezone.js'

// The guard pass is a glance aid, not access control (anyone can fake a
// screenshot), so the rule stays loose: no endTime check, no server refetch.
export const canShowPass = (booking, now = new Date()) =>
  ['approved', 'checked-in'].includes(booking.status) && isSameHubDay(booking.startTime, now)

// Today keeps every non-cancelled booking of the hub day for the whole day;
// the rest split on start time as before.
export const splitBookings = (bookings, now = new Date()) => {
  const groups = { today: [], upcoming: [], past: [] }
  for (const booking of bookings) {
    if (booking.status !== 'cancelled' && isSameHubDay(booking.startTime, now)) groups.today.push(booking)
    else if (new Date(booking.startTime) > now) groups.upcoming.push(booking)
    else groups.past.push(booking)
  }
  return groups
}

// "9h", "1h30": no decimal separator to localise.
export const formatDurationShort = (startTime, endTime) => {
  const minutes = Math.round((new Date(endTime) - new Date(startTime)) / 60000)
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)}h${rest ? String(rest).padStart(2, '0') : ''}`
}
