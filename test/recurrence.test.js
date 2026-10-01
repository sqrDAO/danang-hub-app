// The browser timezone is deliberately not the hub timezone: every planner must
// land on the same hub days and hours regardless of it. Defaults to New York but
// honors an outer TZ, so `TZ=Pacific/Auckland npm test` really runs it from a
// zone ahead of the hub. ESM hoists the imports above this line, which is fine:
// nothing reads the zone at module load.
process.env.TZ = process.env.TZ || 'America/New_York'

import test from 'node:test'
import assert from 'node:assert/strict'
import { getFixedDeskPlanWindow, planRecurrenceStarts } from '../src/utils/recurrence.js'

const iso = (dates) => dates.map((d) => d.toISOString())
const WEEKDAYS = [1, 2, 3, 4, 5]

// Mirrors createFixedDeskPlan → createRecurringBooking in src/services/bookings.js.
const planDeskDays = (startDate, period) => {
  const window = getFixedDeskPlanWindow({ startDate, period })
  const starts = planRecurrenceStarts({
    start: window.start,
    frequency: 'daily',
    endDate: window.end.toISOString(),
    allowedWeekdays: WEEKDAYS,
  })
  return { window, starts }
}

test('weekly desk plan books Mon–Fri 09:00–18:00 hub time from a non-hub browser', () => {
  const { window, starts } = planDeskDays('2026-10-05', 'weekly')
  assert.equal(window.start.toISOString(), '2026-10-05T02:00:00.000Z')
  assert.equal(window.firstDayEnd.toISOString(), '2026-10-05T11:00:00.000Z')
  assert.equal(window.end.toISOString(), '2026-10-09T11:00:00.000Z')
  assert.deepEqual(iso(starts), [
    '2026-10-05T02:00:00.000Z',
    '2026-10-06T02:00:00.000Z',
    '2026-10-07T02:00:00.000Z',
    '2026-10-08T02:00:00.000Z',
    '2026-10-09T02:00:00.000Z',
  ])
})

test('weekly desk plan starting on a Saturday runs through next Friday', () => {
  const { window, starts } = planDeskDays('2026-10-10', 'weekly')
  assert.equal(window.end.toISOString(), '2026-10-16T11:00:00.000Z')
  assert.equal(starts.length, 5)
  assert.equal(starts[0].toISOString(), '2026-10-12T02:00:00.000Z')
})

test('monthly desk plan ends a month less a day after its start', () => {
  const { window, starts } = planDeskDays('2026-10-05', 'monthly')
  assert.equal(window.end.toISOString(), '2026-11-04T11:00:00.000Z')
  assert.equal(starts.at(-1).toISOString(), '2026-11-04T02:00:00.000Z')
})

test('recurrence end date includes its whole hub day', () => {
  const starts = planRecurrenceStarts({
    start: '2026-10-05T09:00:00+07:00',
    frequency: 'daily',
    endDate: '2026-10-07',
  })
  assert.deepEqual(iso(starts), [
    '2026-10-05T02:00:00.000Z',
    '2026-10-06T02:00:00.000Z',
    '2026-10-07T02:00:00.000Z',
  ])
})

test('weekday filter uses the hub weekday, not the browser weekday', () => {
  const starts = planRecurrenceStarts({
    start: '2026-10-05T09:00:00+07:00', // Monday in the hub, Sunday in New York
    frequency: 'daily',
    endDate: '2026-10-11',
    allowedWeekdays: WEEKDAYS,
  })
  assert.equal(starts.length, 5)
  assert.equal(starts[0].toISOString(), '2026-10-05T02:00:00.000Z')
  assert.equal(starts.at(-1).toISOString(), '2026-10-09T02:00:00.000Z')
})

test('weekly steps keep the hub wall time across a US DST change', () => {
  const starts = planRecurrenceStarts({
    start: '2026-10-26T09:00:00+07:00',
    frequency: 'weekly',
    occurrences: 2,
  })
  // New York leaves DST on 2026-11-01; the hub time must stay 09:00.
  assert.deepEqual(iso(starts), ['2026-10-26T02:00:00.000Z', '2026-11-02T02:00:00.000Z'])
})

test('monthly recurrence clamps to month end without drifting', () => {
  const plan = (start) => iso(planRecurrenceStarts({ start, frequency: 'monthly', occurrences: 3 }))
  assert.deepEqual(plan('2027-01-31T09:00:00+07:00'), [
    '2027-01-31T02:00:00.000Z',
    '2027-02-28T02:00:00.000Z',
    '2027-03-31T02:00:00.000Z',
  ])
  assert.equal(plan('2028-01-31T09:00:00+07:00')[1], '2028-02-29T02:00:00.000Z')
})

test('a closed day is skipped without using up an occurrence', () => {
  const closed = '2026-10-06T02:00:00.000Z'
  const starts = planRecurrenceStarts({
    start: '2026-10-05T09:00:00+07:00',
    frequency: 'daily',
    occurrences: 3,
    isOpen: (date) => date.toISOString() !== closed,
  })
  assert.deepEqual(iso(starts), [
    '2026-10-05T02:00:00.000Z',
    '2026-10-07T02:00:00.000Z',
    '2026-10-08T02:00:00.000Z',
  ])
})

test('a filter that rejects every day stops instead of looping', () => {
  const starts = planRecurrenceStarts({
    start: '2026-10-05T09:00:00+07:00',
    frequency: 'daily',
    allowedWeekdays: [],
  })
  assert.deepEqual(starts, [])
})

test('an unknown frequency throws instead of repeating one date', () => {
  assert.throws(() => planRecurrenceStarts({ start: '2026-10-05T09:00:00+07:00', frequency: 'yearly' }))
})
