// The browser timezone is deliberately not the hub timezone here: every helper
// under test must resolve to the same hub calendar day regardless of it.
process.env.TZ = 'America/Los_Angeles'

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addHubDays,
  formatHubDate,
  getHubDayOfMonth,
  getHubDayOfWeek,
  getHubStartOfDay,
  isSameHubDay,
  makeHubDateAtTime,
  parseHubDateTime,
  toDateInputHub,
} from '../src/utils/timezone.js'

test('parses datetime-local strings as hub time, not browser time', () => {
  assert.equal(parseHubDateTime('2026-08-05T09:00').toISOString(), '2026-08-05T02:00:00.000Z')
  assert.equal(parseHubDateTime('2026-08-05T09:00:00').toISOString(), '2026-08-05T02:00:00.000Z')
  assert.equal(parseHubDateTime('2026-08-05').toISOString(), '2026-08-04T17:00:00.000Z')
})

test('leaves strings that already carry an offset untouched', () => {
  assert.equal(parseHubDateTime('2026-08-05T02:00:00Z').toISOString(), '2026-08-05T02:00:00.000Z')
  assert.equal(parseHubDateTime('2026-08-05T09:00:00+07:00').toISOString(), '2026-08-05T02:00:00.000Z')
  assert.equal(parseHubDateTime('2026-08-05T09:00:00-0500').toISOString(), '2026-08-05T14:00:00.000Z')
})

test('formats date inputs in the hub timezone instead of UTC', () => {
  assert.equal(toDateInputHub(new Date('2026-08-04T17:30:00.000Z')), '2026-08-05')
  assert.equal(toDateInputHub(new Date('2026-08-05T00:30:00.000Z')), '2026-08-05')
})

test('snaps a date to hub midnight, not browser midnight', () => {
  // 00:30 UTC on Aug 5 is Aug 5 07:30 in the hub and Aug 4 17:30 in Los Angeles.
  const start = getHubStartOfDay(new Date('2026-08-05T00:30:00.000Z'))
  assert.equal(start.toISOString(), '2026-08-04T17:00:00.000Z')
  assert.equal(toDateInputHub(start), '2026-08-05')
})

test('builds booking instants at the hub wall-clock time', () => {
  const day = getHubStartOfDay(new Date('2026-08-05T00:30:00.000Z'))
  // 09:00 in the hub is 02:00 UTC — not 09:00 in the browser's timezone.
  assert.equal(makeHubDateAtTime(day, 9, 0).toISOString(), '2026-08-05T02:00:00.000Z')
  assert.equal(makeHubDateAtTime(day, 17, 30).toISOString(), '2026-08-05T10:30:00.000Z')
})

test('adds whole hub days without drifting off hub midnight', () => {
  const day = getHubStartOfDay(new Date('2026-08-05T00:30:00.000Z'))
  assert.equal(toDateInputHub(addHubDays(day, 1)), '2026-08-06')
  assert.equal(toDateInputHub(addHubDays(day, -1)), '2026-08-04')
  assert.equal(toDateInputHub(addHubDays(day, 30)), '2026-09-04')
  assert.equal(addHubDays(day, 1).toISOString(), '2026-08-05T17:00:00.000Z')
})

test('reports the hub weekday and day of month', () => {
  // 2026-08-05 is a Wednesday in the hub, still Tuesday in Los Angeles.
  const instant = new Date('2026-08-05T00:30:00.000Z')
  assert.equal(getHubDayOfWeek(instant), 3)
  assert.equal(getHubDayOfMonth(instant), 5)
})

test('compares hub calendar days across the browser day boundary', () => {
  const evening = new Date('2026-08-05T15:00:00.000Z') // Aug 5 22:00 hub
  const morning = new Date('2026-08-05T02:00:00.000Z') // Aug 5 09:00 hub
  assert.equal(isSameHubDay(evening, morning), true)
  assert.equal(isSameHubDay(evening.getTime(), morning.getTime()), true)
  assert.equal(isSameHubDay(evening, new Date('2026-08-05T17:30:00.000Z')), false)
})

test('formats calendar labels on the hub day', () => {
  const instant = new Date('2026-08-05T00:30:00.000Z')
  assert.equal(formatHubDate(instant, 'en-US', { weekday: 'short' }), 'Wed')
  assert.equal(formatHubDate(instant, 'en-US', { month: 'short' }), 'Aug')
})
