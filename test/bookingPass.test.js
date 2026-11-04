// Browser zone deliberately not the hub's: "today" must be the hub day.
process.env.TZ = 'America/Los_Angeles'

import test from 'node:test'
import assert from 'node:assert/strict'
import { canShowPass, splitBookings, formatDurationShort } from '../src/utils/bookingPass.js'

// 10:00 on 04/11/2026 in Da Nang
const now = new Date('2026-11-04T10:00:00+07:00')
const at = (iso, status = 'approved') => ({ status, startTime: new Date(iso) })

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

test('short duration has no decimals', () => {
  assert.equal(formatDurationShort('2026-11-04T09:00:00Z', '2026-11-04T18:00:00Z'), '9h')
  assert.equal(formatDurationShort('2026-11-04T14:00:00Z', '2026-11-04T15:30:00Z'), '1h30')
  assert.equal(formatDurationShort('2026-11-04T14:00:00Z', '2026-11-04T14:30:00Z'), '0h30')
})
