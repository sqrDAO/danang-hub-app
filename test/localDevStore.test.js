import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkLocalBookingConflicts,
  createLocalAmenity,
  createLocalBooking,
  createLocalPartner,
  deleteLocalPartner,
  getLocalAmenity,
  setLocalPartnerDesk,
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
  const book = (memberId) => createLocalBooking({
    memberId,
    amenityId: 'local-desk',
    startTime: start,
    endTime: end
  })
  book('a')
  assert.equal(checkLocalBookingConflicts('local-desk', start, end).hasConflicts, false)
  for (let i = 2; i <= 8; i += 1) book(`m${i}`)
  assert.equal(checkLocalBookingConflicts('local-desk', start, end).hasConflicts, true)
})

test('a partner desk is reserved for its partner and released on change or removal', () => {
  resetLocalDevStore()
  const deskA = createLocalAmenity({ name: 'Desk A', type: 'desk' })
  const deskB = createLocalAmenity({ name: 'Desk B', type: 'desk' })
  const partner = createLocalPartner({ name: '9AM Games' })

  setLocalPartnerDesk(partner.id, deskA)
  assert.equal(getLocalAmenity(deskA).reservedForPartnerId, partner.id)

  setLocalPartnerDesk(partner.id, deskB)
  assert.equal(getLocalAmenity(deskA).reservedForPartnerId, null)
  assert.equal(getLocalAmenity(deskB).reservedForPartnerId, partner.id)

  setLocalPartnerDesk(partner.id, null)
  assert.equal(getLocalAmenity(deskB).reservedForPartnerId, null)

  setLocalPartnerDesk(partner.id, deskA)
  deleteLocalPartner(partner.id)
  assert.equal(getLocalAmenity(deskA).reservedForPartnerId, null)
})
