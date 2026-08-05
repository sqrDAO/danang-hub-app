const isSameCalendarDay = (firstMs, secondMs) =>
  new Date(firstMs).toDateString() === new Date(secondMs).toDateString()

const pointState = (status, nextRange = null) => ({ status, nextRange })

const countOverlappingBookings = (slotMs, bookingRanges) => {
  let overlapping = 0
  for (let i = 0; i < bookingRanges.length; i++) {
    const [startMs, endMs] = bookingRanges[i]
    if (slotMs >= startMs && slotMs < endMs) overlapping++
  }
  return overlapping
}

export const getBaseSlotStatus = (slotMs, context) => {
  if (!context.dayAvailable) return 'unavailable'
  if (slotMs < context.now) return 'past'
  const overlapping = countOverlappingBookings(slotMs, context.bookingRanges)
  const fullyBooked = context.isSharedDesk
    ? overlapping >= context.capacity
    : overlapping > 0
  return fullyBooked ? 'booked' : 'available'
}

export const isRangeAvailable = (startMs, endMs, intervals) =>
  endMs > startMs && intervals.every(({ key, status }) =>
    key < startMs || key >= endMs || status === 'available'
  )

const getDefaultPointState = (point, allowStart = true) => {
  const isAvailableStart = allowStart && !point.isBoundary && point.baseStatus === 'available'
  return pointState(
    point.isBoundary ? 'closing' : point.baseStatus,
    isAvailableStart ? { startMs: point.key, endMs: null } : null
  )
}

const getEndPointState = (point, startMs, intervals) => {
  const canEnd = isRangeAvailable(startMs, point.key, intervals)
  return pointState(
    canEnd ? 'range-end-candidate' : 'range-blocked',
    canEnd ? { startMs, endMs: point.key } : null
  )
}

const getStartCandidateState = (point, endMs, intervals) => {
  if (point.isBoundary || point.baseStatus !== 'available') {
    return getDefaultPointState(point, false)
  }
  const canMoveStart = isRangeAvailable(point.key, endMs, intervals)
  return pointState(
    canMoveStart ? 'range-start-candidate' : 'range-blocked',
    canMoveStart ? { startMs: point.key, endMs } : null
  )
}

const getAnchoredPointState = (point, startMs, intervals) => {
  if (point.key === startMs) {
    return pointState('range-start', { startMs: null, endMs: null })
  }
  if (point.key < startMs) return getDefaultPointState(point)
  return getEndPointState(point, startMs, intervals)
}

const getCompleteRangePointState = (point, startMs, endMs, intervals) => {
  if (point.key === startMs) {
    return pointState('range-start', { startMs: null, endMs: null })
  }
  if (point.key === endMs) {
    return pointState('range-end', { startMs, endMs: null })
  }
  if (point.key < startMs) return getStartCandidateState(point, endMs, intervals)
  if (point.key < endMs) return pointState('range-selected', { startMs, endMs: point.key })
  return getEndPointState(point, startMs, intervals)
}

export const getPointState = (point, selection, intervals) => {
  const { startMs, endMs } = selection
  const selectionOnAnotherDay = startMs !== null && !isSameCalendarDay(point.key, startMs)
  if (startMs === null || selectionOnAnotherDay) return getDefaultPointState(point)
  if (endMs === null) return getAnchoredPointState(point, startMs, intervals)
  return getCompleteRangePointState(point, startMs, endMs, intervals)
}
