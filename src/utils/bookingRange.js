// Extension is required: test/bookingRange.test.js loads this through Node's ESM
// loader, which does not resolve extensionless specifiers the way Vite does.
import { isSameHubDay } from './timezone.js'

const rangeState = (status, nextRange = null) => ({ status, nextRange })

const overlapsCell = (cell, [bookingStartMs, bookingEndMs]) =>
  bookingStartMs < cell.endMs && bookingEndMs > cell.startMs

const getPeakBookingCount = (cell, bookingRanges) => {
  const checkTimes = new Set([cell.startMs])

  bookingRanges.forEach(([startMs]) => {
    if (startMs > cell.startMs && startMs < cell.endMs) checkTimes.add(startMs)
  })

  return Math.max(...[...checkTimes].map(time =>
    bookingRanges.filter(([startMs, endMs]) => startMs <= time && endMs > time).length
  ))
}

export const getBaseSlotStatus = (cell, context) => {
  if (!context.dayAvailable) return 'unavailable'
  if (cell.startMs < context.now) return 'past'

  const overlappingBookings = context.bookingRanges.filter(range => overlapsCell(cell, range))
  if (!context.isSharedDesk) return overlappingBookings.length > 0 ? 'booked' : 'available'

  return getPeakBookingCount(cell, overlappingBookings) >= context.capacity
    ? 'booked'
    : 'available'
}

export const isRangeAvailable = (startMs, endMs, cells) => {
  if (endMs <= startMs) return false

  const selectedCells = cells.filter(cell =>
    cell.startMs >= startMs && cell.endMs <= endMs
  )

  return selectedCells.length > 0 && selectedCells.every(cell => cell.baseStatus === 'available')
}

const getDefaultCellState = (cell) => rangeState(
  cell.baseStatus,
  cell.baseStatus === 'available'
    ? { startMs: cell.startMs, endMs: cell.endMs }
    : null
)

const getCandidateState = (cell, startMs, endMs, cells, status) => {
  const isAvailable = isRangeAvailable(startMs, endMs, cells)
  return rangeState(
    isAvailable ? status : 'range-blocked',
    isAvailable ? { startMs, endMs } : null
  )
}

const getUnhighlightedCandidateState = (cell, startMs, endMs, cells) => {
  const isAvailable = isRangeAvailable(startMs, endMs, cells)
  return rangeState(
    isAvailable ? 'available' : 'range-blocked',
    isAvailable ? { startMs, endMs } : null
  )
}

const getSelectedCellState = (cell, selection, cells) => {
  const { startMs, endMs } = selection
  const startCell = cells.find(candidate => candidate.startMs === startMs)
  const isSingleCellSelection = startCell?.endMs === endMs

  if (cell.startMs === startMs && cell.endMs === endMs) {
    return rangeState('range-single', { startMs: null, endMs: null })
  }

  if (cell.startMs === startMs) {
    return rangeState('range-start', { startMs: null, endMs: null })
  }

  if (cell.endMs === endMs) {
    return rangeState('range-end', {
      startMs,
      endMs: startCell?.endMs ?? startMs,
    })
  }

  if (cell.endMs <= startMs) {
    return getDefaultCellState(cell)
  }

  if (cell.startMs < endMs) {
    return rangeState('range-selected', { startMs, endMs: cell.endMs })
  }

  return isSingleCellSelection
    ? getCandidateState(cell, startMs, cell.endMs, cells, 'range-end-candidate')
    : getUnhighlightedCandidateState(cell, startMs, cell.endMs, cells)
}

export const getCellState = (cell, selection, cells) => {
  const { startMs, endMs } = selection
  const selectionOnAnotherDay = startMs !== null && !isSameHubDay(cell.startMs, startMs)

  if (startMs === null || endMs === null || selectionOnAnotherDay) {
    return getDefaultCellState(cell)
  }

  return getSelectedCellState(cell, selection, cells)
}
