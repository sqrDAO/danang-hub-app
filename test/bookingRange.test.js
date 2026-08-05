import test from 'node:test'
import assert from 'node:assert/strict'
import { getBaseSlotStatus, getCellState } from '../src/utils/bookingRange.js'

const at = (hour, minute = 0) => new Date(2026, 7, 10, hour, minute).getTime()

const createCell = (hour, minute = 0, options = {}) => ({
  startMs: at(hour, minute),
  endMs: at(hour, minute + 30),
  baseStatus: 'available',
  ...options,
})

test('the first click selects a complete 30-minute cell and a repeat click clears it', () => {
  const cell = createCell(9)
  const cells = [cell]

  assert.deepEqual(getCellState(cell, { startMs: null, endMs: null }, cells), {
    status: 'available',
    nextRange: { startMs: at(9), endMs: at(9, 30) },
  })
  assert.deepEqual(getCellState(cell, { startMs: at(9), endMs: at(9, 30) }, cells), {
    status: 'range-single',
    nextRange: { startMs: null, endMs: null },
  })
})

test('a later cell expands the range while an earlier cell resets it to 30 minutes', () => {
  const cells = [createCell(9), createCell(9, 30), createCell(10)]

  assert.deepEqual(
    getCellState(cells[1], { startMs: at(9), endMs: at(9, 30) }, cells),
    {
      status: 'range-end-candidate',
      nextRange: { startMs: at(9), endMs: at(10) },
    }
  )
  assert.deepEqual(
    getCellState(cells[0], { startMs: at(9, 30), endMs: at(10) }, cells),
    {
      status: 'available',
      nextRange: { startMs: at(9), endMs: at(9, 30) },
    }
  )
})

test('a complete range can be cleared, shortened, extended, or reset to an earlier cell', () => {
  const cells = [createCell(8, 30), createCell(9), createCell(9, 30), createCell(10), createCell(10, 30)]
  const selection = { startMs: at(9), endMs: at(10, 30) }

  assert.deepEqual(getCellState(cells[1], selection, cells), {
    status: 'range-start',
    nextRange: { startMs: null, endMs: null },
  })
  assert.deepEqual(getCellState(cells[2], selection, cells), {
    status: 'range-selected',
    nextRange: { startMs: at(9), endMs: at(10) },
  })
  assert.deepEqual(getCellState(cells[3], selection, cells), {
    status: 'range-end',
    nextRange: { startMs: at(9), endMs: at(9, 30) },
  })
  assert.deepEqual(getCellState(cells[0], selection, cells), {
    status: 'available',
    nextRange: { startMs: at(8, 30), endMs: at(9) },
  })
  assert.deepEqual(getCellState(cells[4], selection, cells), {
    status: 'available',
    nextRange: { startMs: at(9), endMs: at(11) },
  })
})

test('a cell range is blocked when it would include an unavailable cell', () => {
  const cells = [
    createCell(9),
    createCell(9, 30, { baseStatus: 'booked' }),
    createCell(10),
  ]

  assert.deepEqual(
    getCellState(cells[2], { startMs: at(9), endMs: at(9, 30) }, cells),
    { status: 'range-blocked', nextRange: null }
  )
})

test('booking overlap is evaluated over the full cell, with desk capacity checked at each change', () => {
  const cell = createCell(9)
  const baseContext = {
    dayAvailable: true,
    now: at(8),
    bookingRanges: [[at(9, 15), at(9, 30)]],
    isSharedDesk: false,
    capacity: 1,
  }

  assert.equal(getBaseSlotStatus(cell, baseContext), 'booked')
  assert.equal(getBaseSlotStatus(cell, { ...baseContext, isSharedDesk: true, capacity: 2 }), 'available')
  assert.equal(getBaseSlotStatus(cell, {
    ...baseContext,
    isSharedDesk: true,
    capacity: 2,
    bookingRanges: [
      [at(9), at(9, 20)],
      [at(9, 10), at(9, 30)],
    ],
  }), 'booked')
})
