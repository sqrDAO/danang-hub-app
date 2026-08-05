import test from 'node:test'
import assert from 'node:assert/strict'
import { getPointState } from '../src/utils/bookingRange.js'

const at = (hour, minute = 0) => new Date(2026, 7, 10, hour, minute).getTime()

const createPoint = (hour, options = {}) => ({
  key: at(hour),
  baseStatus: 'available',
  isBoundary: false,
  ...options,
})

const createIntervals = (statuses) => statuses.map(([hour, status]) => ({ key: at(hour), status }))

test('first click sets a start and clicking it again clears the range', () => {
  const point = createPoint(9)
  const intervals = createIntervals([[9, 'available']])

  assert.deepEqual(getPointState(point, { startMs: null, endMs: null }, intervals), {
    status: 'available',
    nextRange: { startMs: at(9), endMs: null },
  })
  assert.deepEqual(getPointState(point, { startMs: at(9), endMs: null }, intervals), {
    status: 'range-start',
    nextRange: { startMs: null, endMs: null },
  })
})

test('an earlier click replaces a start while a later click becomes a valid end', () => {
  const intervals = createIntervals([[8, 'available'], [9, 'available'], [10, 'available']])

  assert.deepEqual(getPointState(createPoint(8), { startMs: at(9), endMs: null }, intervals), {
    status: 'available',
    nextRange: { startMs: at(8), endMs: null },
  })
  assert.deepEqual(getPointState(createPoint(10), { startMs: at(9), endMs: null }, intervals), {
    status: 'range-end-candidate',
    nextRange: { startMs: at(9), endMs: at(10) },
  })
})

test('a complete range can adjust or remove either endpoint', () => {
  const intervals = createIntervals([[8, 'available'], [9, 'available'], [10, 'available'], [11, 'available']])
  const selection = { startMs: at(9), endMs: at(11) }

  assert.deepEqual(getPointState(createPoint(8), selection, intervals), {
    status: 'range-start-candidate',
    nextRange: { startMs: at(8), endMs: at(11) },
  })
  assert.deepEqual(getPointState(createPoint(10), selection, intervals), {
    status: 'range-selected',
    nextRange: { startMs: at(9), endMs: at(10) },
  })
  assert.deepEqual(getPointState(createPoint(11), selection, intervals), {
    status: 'range-end',
    nextRange: { startMs: at(9), endMs: null },
  })
})

test('only endpoints with a continuously available range are enabled, including closing', () => {
  const selection = { startMs: at(9), endMs: null }
  const closing = createPoint(10, { baseStatus: 'closing', isBoundary: true })
  const available = createIntervals([[9, 'available']])
  const blocked = [
    { key: at(9), status: 'available' },
    { key: at(9, 30), status: 'booked' },
  ]

  assert.equal(getPointState(closing, selection, available).status, 'range-end-candidate')
  assert.equal(getPointState(closing, selection, blocked).status, 'range-blocked')
})
