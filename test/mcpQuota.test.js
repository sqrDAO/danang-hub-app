import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { hubDay, countOpenPending, nextDailyQuota, MCP_DAILY_CREATE_LIMIT } = require('./mcpQuota')

test('hubDay uses Asia/Ho_Chi_Minh, not UTC', () => {
  assert.equal(hubDay(Date.parse('2026-11-26T16:59:00Z')), '2026-11-26')
  assert.equal(hubDay(Date.parse('2026-11-26T17:00:00Z')), '2026-11-27')
})

test('nextDailyQuota counts up within a day, resets on a new day, stops at the limit', () => {
  assert.deepEqual(nextDailyQuota(undefined, '2026-11-26'), { day: '2026-11-26', creates: 1 })
  assert.deepEqual(nextDailyQuota({ day: '2026-11-26', creates: 3 }, '2026-11-26'), { day: '2026-11-26', creates: 4 })
  assert.deepEqual(nextDailyQuota({ day: '2026-11-25', creates: MCP_DAILY_CREATE_LIMIT }, '2026-11-26'),
    { day: '2026-11-26', creates: 1 })
  assert.equal(nextDailyQuota({ day: '2026-11-26', creates: MCP_DAILY_CREATE_LIMIT }, '2026-11-26'), null)
})

test('countOpenPending skips desks, ended and non-pending bookings; unknown amenities count', () => {
  const now = Date.parse('2026-11-26T00:00:00Z')
  const later = new Date(now + 3600000)
  const amenities = new Map([['desk', { type: 'desk' }], ['room', { type: 'meeting-room' }]])
  const bookings = [
    { status: 'pending', amenityId: 'room', endTime: later },
    { status: 'pending', amenityId: 'gone', endTime: later },
    { status: 'pending', amenityId: 'desk', endTime: later },
    { status: 'pending', amenityId: 'room', endTime: new Date(now - 1) },
    { status: 'approved', amenityId: 'room', endTime: later }
  ]
  assert.equal(countOpenPending(bookings, amenities, now), 2)
})
