// Browser zone deliberately not the hub's: "today" must be the hub day.
process.env.TZ = 'America/Los_Angeles'

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canShowPass,
  splitBookings,
  deduplicateBookings,
  formatHubTimeRange,
  formatDurationShort,
} from '../src/utils/bookingPass.js'

// 10:00 on 04/11/2026 in Da Nang
const now = new Date('2026-11-04T10:00:00+07:00')
const HOUR = 3600000
const at = (iso, status = 'approved') => {
  const startTime = new Date(iso)
  return { status, startTime, endTime: new Date(startTime.getTime() + HOUR) }
}

test('pass shows for approved or checked-in bookings on the hub day', () => {
  assert.equal(canShowPass(at('2026-11-04T09:00:00+07:00'), now), true)
  assert.equal(canShowPass(at('2026-11-04T09:00:00+07:00', 'checked-in'), now), true)
  // ended this morning: still shown, the rule is deliberately loose
  assert.equal(canShowPass(at('2026-11-04T07:00:00+07:00'), now), true)
  // 23:30 hub time is the next UTC day, still today at the hub
  assert.equal(canShowPass(at('2026-11-04T23:30:00+07:00'), now), true)
})

test('pass hidden for other statuses and other days', () => {
  for (const status of ['pending', 'cancelled', 'completed', 'rejected']) {
    assert.equal(canShowPass(at('2026-11-04T09:00:00+07:00', status), now), false)
  }
  assert.equal(canShowPass(at('2026-11-03T09:00:00+07:00'), now), false)
  assert.equal(canShowPass(at('2026-11-05T00:30:00+07:00'), now), false)
})

test('every booking lands in exactly one of today, upcoming, past', () => {
  const morning = at('2026-11-04T07:00:00+07:00')
  const pendingLate = at('2026-11-04T23:30:00+07:00', 'pending')
  const cancelledLater = at('2026-11-04T15:00:00+07:00', 'cancelled')
  const tomorrow = at('2026-11-05T09:00:00+07:00')
  const yesterday = at('2026-11-03T09:00:00+07:00')
  const { today, upcoming, past } = splitBookings([morning, pendingLate, cancelledLater, tomorrow, yesterday], now)
  assert.deepEqual(today, [morning, pendingLate])
  assert.deepEqual(upcoming, [cancelledLater, tomorrow])
  assert.deepEqual(past, [yesterday])
})

test('rejected and cancelled bookings of today leave Today the same way', () => {
  const rejectedLater = at('2026-11-04T14:00:00+07:00', 'rejected')
  const cancelledLater = at('2026-11-04T15:00:00+07:00', 'cancelled')
  const rejectedEarlier = at('2026-11-04T08:00:00+07:00', 'rejected')
  const { today, upcoming, past } = splitBookings([rejectedLater, cancelledLater, rejectedEarlier], now)
  assert.deepEqual(today, [])
  assert.deepEqual(upcoming, [rejectedLater, cancelledLater])
  assert.deepEqual(past, [rejectedEarlier])
})

test('bookings without valid times go to Past and never get a pass', () => {
  const noStart = { status: 'approved', endTime: new Date('2026-11-04T18:00:00+07:00') }
  const noEnd = { status: 'approved', startTime: new Date('2026-11-04T09:00:00+07:00') }
  const garbage = { status: 'approved', startTime: 'not a date', endTime: 'nope' }
  for (const booking of [noStart, noEnd, garbage]) {
    assert.equal(canShowPass(booking, now), false)
  }
  assert.deepEqual(splitBookings([noStart, noEnd, garbage], now).past, [noStart, noEnd, garbage])
})

test('dedup keeps the active booking when a cancelled one shares its slot', () => {
  const slot = { amenityId: 'desk', startTime: '2026-11-04T02:00:00.000Z', endTime: '2026-11-04T11:00:00.000Z' }
  const cancelled = { ...slot, id: 'a', status: 'cancelled' }
  const approved = { ...slot, id: 'b', status: 'approved' }
  const twin = { ...slot, id: 'c', status: 'approved' }
  const other = { ...slot, id: 'd', amenityId: 'room', status: 'cancelled' }
  assert.deepEqual(deduplicateBookings([cancelled, approved, twin, other]), [approved, other])
})

test('time range is 24h HH:mm in hub time', () => {
  const booking = { startTime: '2026-11-04T02:00:00Z', endTime: '2026-11-04T11:30:00Z' }
  assert.equal(formatHubTimeRange(booking), '09:00 – 18:30')
})

test('short duration has no decimals', () => {
  assert.equal(formatDurationShort('2026-11-04T09:00:00Z', '2026-11-04T18:00:00Z'), '9h')
  assert.equal(formatDurationShort('2026-11-04T14:00:00Z', '2026-11-04T15:30:00Z'), '1h30')
  assert.equal(formatDurationShort('2026-11-04T14:00:00Z', '2026-11-04T14:30:00Z'), '0h30')
})
