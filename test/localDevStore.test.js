import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkLocalBookingConflicts,
  createLocalBooking,
  filterLocalBookings,
  overlappingLocalBookings,
  resetLocalDevStore
} from '../src/services/localDevStore.js'

test('filters bookings by member and amenity', () => {
  const bookings = [
    { id: 'a', memberId: 'me', amenityId: 'desk', startTime: new Date('2026-09-01T02:00:00Z'), status: 'approved' },
    { id: 'b', memberId: 'you', amenityId: 'desk', startTime: new Date('2026-09-01T03:00:00Z'), status: 'approved' },
    { id: 'c', memberId: 'me', amenityId: 'room', startTime: new Date('2026-09-01T04:00:00Z'), status: 'approved' }
  ]
  assert.deepEqual(filterLocalBookings(bookings, { memberId: 'me' }).map((item) => item.id), ['c', 'a'])
  assert.deepEqual(filterLocalBookings(bookings, { amenityId: 'room' }).map((item) => item.id), ['c'])
})

test('detects overlapping ranges on a meeting room', () => {
  const bookings = [{
    id: 'busy',
    amenityId: 'room',
    startTime: new Date('2026-09-01T03:00:00Z'),
    endTime: new Date('2026-09-01T04:00:00Z'),
    status: 'approved'
  }]
  const overlaps = overlappingLocalBookings(
    bookings,
    'room',
    '2026-09-01T03:30:00Z',
    '2026-09-01T04:30:00Z'
  )
  assert.equal(overlaps.length, 1)
})

test('desk conflicts only after capacity is full', () => {
  resetLocalDevStore()
  const start = new Date('2026-09-10T02:00:00Z')
  const end = new Date('2026-09-10T03:00:00Z')
  createLocalBooking({
    memberId: 'a',
    amenityId: 'local-desk',
    startTime: start,
    endTime: end
  })
  const first = checkLocalBookingConflicts('local-desk', start, end)
  assert.equal(first.hasConflicts, false)
})
