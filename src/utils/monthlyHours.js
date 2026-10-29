/**
 * The 40-hour monthly limit on coworking desk bookings (issue #112), for the
 * booking page. Mirrors functions/monthlyHours.js, which enforces it; the two
 * must be edited together. Pure, so `test/monthlyHours.test.js` can run it.
 *
 * Counted: bookings on a desk amenity that are not part of a desk plan, while
 * pending, approved, checked-in or completed. Hours split by hub month.
 */
export const MONTHLY_DESK_HOURS = 40
// Server cancellation reason (functions/monthlyHours.js).
export const MONTHLY_HOURS_LIMIT_REASON = 'monthly-hours-limit'
const COUNTED_STATUSES = ['pending', 'approved', 'checked-in', 'completed']
const DESK_PLAN_TYPES = ['fixed-desk', 'partner-desk']
const HOUR_MS = 60 * 60 * 1000
// Vietnam has no DST: hub time is always UTC+7.
const OFFSET_MS = 7 * HOUR_MS

const toMs = (value) => new Date(value).getTime()

export const hubMonthKey = (ms) => new Date(ms + OFFSET_MS).toISOString().slice(0, 7)

const nextHubMonthStart = (ms) => {
  const hub = new Date(ms + OFFSET_MS)
  return Date.UTC(hub.getUTCFullYear(), hub.getUTCMonth() + 1, 1) - OFFSET_MS
}

const amenityById = (amenities, id) => amenities.find(a => a.id === id)

export const countsTowardLimit = (booking, amenities) => {
  const amenity = amenityById(amenities, booking.amenityId)
  return amenity?.type === 'desk' &&
    !DESK_PLAN_TYPES.includes(booking.planType) &&
    COUNTED_STATUSES.includes(booking.status)
}

export const hoursByMonth = (startTime, endTime) => {
  const hours = new Map()
  const end = toMs(endTime)
  let cursor = toMs(startTime)
  while (cursor < end) {
    const sliceEnd = Math.min(end, nextHubMonthStart(cursor))
    const key = hubMonthKey(cursor)
    hours.set(key, (hours.get(key) || 0) + (sliceEnd - cursor) / HOUR_MS)
    cursor = sliceEnd
  }
  return hours
}

export const usageByMonth = (bookings, amenities) => {
  const usage = new Map()
  bookings.filter(b => countsTowardLimit(b, amenities)).forEach(b => {
    hoursByMonth(b.startTime, b.endTime).forEach((h, key) => usage.set(key, (usage.get(key) || 0) + h))
  })
  return usage
}

export const hoursUsedThisMonth = (bookings, amenities, now = new Date()) =>
  usageByMonth(bookings, amenities).get(hubMonthKey(now.getTime())) || 0

// The first month the new ranges (a single booking, or every occurrence of a
// series) would take over the limit on top of the member's bookings, or null.
// `ranges` are { amenityId, startTime, endTime }.
export const monthOverLimit = (ranges, bookings, amenities) => {
  const usage = usageByMonth(bookings, amenities)
  const sorted = [...ranges].sort((a, b) => toMs(a.startTime) - toMs(b.startTime))
  for (const range of sorted) {
    if (!countsTowardLimit({ ...range, status: 'pending' }, amenities)) continue
    for (const [month, hours] of hoursByMonth(range.startTime, range.endTime)) {
      const used = usage.get(month) || 0
      if (used + hours > MONTHLY_DESK_HOURS + 1e-9) {
        return { month, hoursLeft: Math.max(0, MONTHLY_DESK_HOURS - used) }
      }
      usage.set(month, used + hours)
    }
  }
  return null
}
