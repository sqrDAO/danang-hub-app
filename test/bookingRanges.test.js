import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBookingRanges } from '../src/utils/bookingRanges.js'

test('maps well-formed ranges to Dates and keeps the status', () => {
  const ranges = parseBookingRanges({
    ranges: [{ startTime: '2026-08-12T02:00:00.000Z', endTime: '2026-08-12T04:00:00.000Z', status: 'approved' }],
  })
  assert.equal(ranges.length, 1)
  assert.ok(ranges[0].startTime instanceof Date)
  assert.equal(ranges[0].startTime.toISOString(), '2026-08-12T02:00:00.000Z')
  assert.equal(ranges[0].endTime.toISOString(), '2026-08-12T04:00:00.000Z')
  assert.equal(ranges[0].status, 'approved')
})

test('an amenity with nothing booked is an empty calendar, not an error', () => {
  assert.deepEqual(parseBookingRanges({ ranges: [] }), [])
})

// Every case below would otherwise paint the whole grid free.
test('throws when ranges is missing', () => {
  assert.throws(() => parseBookingRanges({}), /missing its ranges/)
})

test('throws when the payload is absent', () => {
  assert.throws(() => parseBookingRanges(undefined), /missing its ranges/)
})

test('throws when ranges is not an array', () => {
  assert.throws(() => parseBookingRanges({ ranges: { startTime: '2026-08-12T02:00:00.000Z' } }), /missing its ranges/)
})

test('throws when a range has an unparseable time', () => {
  assert.throws(
    () => parseBookingRanges({ ranges: [{ startTime: 'not-a-date', endTime: '2026-08-12T04:00:00.000Z' }] }),
    /unreadable range/
  )
})

test('throws when a range is missing its end', () => {
  assert.throws(
    () => parseBookingRanges({ ranges: [{ startTime: '2026-08-12T02:00:00.000Z' }] }),
    /unreadable range/
  )
})

test('throws when a range is null', () => {
  assert.throws(() => parseBookingRanges({ ranges: [null] }), /unreadable range/)
})

test('one bad range rejects the whole response', () => {
  assert.throws(
    () => parseBookingRanges({
      ranges: [
        { startTime: '2026-08-12T02:00:00.000Z', endTime: '2026-08-12T04:00:00.000Z', status: 'approved' },
        { startTime: '2026-08-13T02:00:00.000Z', endTime: 'garbage', status: 'pending' },
      ],
    }),
    /unreadable range/
  )
})
