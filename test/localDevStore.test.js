import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkLocalBookingConflicts,
  createLocalAmenity,
  createLocalBooking,
  createLocalPartner,
  deleteLocalPartner,
  deleteLocalAmenity,
  updateLocalAmenity,
  listLocalMembers,
  getLocalBooking,
  listLocalPartners,
  updateLocalMember,
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
  const partner = createLocalPartner({ name: '9AM Games', deskAmenityId: deskA })

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

test('a desk held by another partner is refused, an orphaned hold is taken over', () => {
  resetLocalDevStore()
  const desk = createLocalAmenity({ name: 'Desk', type: 'desk' })
  const spare = createLocalAmenity({ name: 'Spare', type: 'desk' })
  createLocalPartner({ name: '9AM Games', deskAmenityId: desk })
  const diid = createLocalPartner({ name: 'DiiD', deskAmenityId: spare })
  assert.throws(() => setLocalPartnerDesk(diid.id, desk), /partner-desk-taken/)
  assert.throws(() => setLocalPartnerDesk(diid.id, 'gone'), /partner-desk-missing/)
  updateLocalAmenity(desk, { reservedForPartnerId: 'deleted-partner' })
  setLocalPartnerDesk(diid.id, desk)
  assert.equal(getLocalAmenity(desk).reservedForPartnerId, diid.id)
})

test('a reserved desk cannot be retyped or deleted until released', () => {
  resetLocalDevStore()
  const desk = createLocalAmenity({ name: 'Desk', type: 'desk' })
  const partner = createLocalPartner({ name: '9AM Games', deskAmenityId: desk })
  assert.throws(() => updateLocalAmenity(desk, { type: 'meeting-room' }), /amenity-reserved-for-partner/)
  assert.throws(() => deleteLocalAmenity(desk), /amenity-reserved-for-partner/)
  updateLocalAmenity(desk, { capacity: 10 })
  setLocalPartnerDesk(partner.id, null)
  deleteLocalAmenity(desk)
  assert.equal(getLocalAmenity(desk), null)
})

test('a partner is created with its desk reserved, or not at all', () => {
  resetLocalDevStore()
  const desk = createLocalAmenity({ name: 'Desk', type: 'desk' })
  const nineAm = createLocalPartner({ name: '9AM Games', deskAmenityId: desk })
  assert.equal(nineAm.deskAmenityId, desk)
  assert.equal(getLocalAmenity(desk).reservedForPartnerId, nineAm.id)
  assert.throws(() => createLocalPartner({ name: 'DiiD', deskAmenityId: desk }), /partner-desk-taken/)
  assert.throws(() => createLocalPartner({ name: 'No desk' }), /partner-desk-missing/)
  assert.deepEqual(listLocalPartners().map(p => p.name), ['9AM Games'])
})

test('removing a partner detaches its members and releases its desk', () => {
  resetLocalDevStore()
  const desk = createLocalAmenity({ name: 'Desk', type: 'desk' })
  const partner = createLocalPartner({ name: 'DiiD', deskAmenityId: desk })
  const [first, second] = listLocalMembers()
  updateLocalMember(first.id, { partnerId: partner.id })
  updateLocalMember(second.id, { partnerId: 'another-partner' })
  const day = (start) => createLocalBooking({
    memberId: first.id, amenityId: desk, status: 'approved', planType: 'partner-desk',
    planGroupId: `partner_${first.id}`, startTime: start, endTime: new Date(start.getTime() + 9 * 3600e3)
  })
  const upcoming = day(new Date(Date.now() + 2 * 24 * 3600e3))
  const underway = day(new Date(Date.now() - 3600e3))
  deleteLocalPartner(partner.id)
  assert.equal(getLocalBooking(upcoming).status, 'cancelled')
  assert.equal(getLocalBooking(upcoming).cancelledReason, 'partner-removed')
  assert.equal(getLocalBooking(underway).status, 'approved')
  const byId = Object.fromEntries(listLocalMembers().map(m => [m.id, m]))
  assert.equal(byId[first.id].partnerId, null)
  assert.equal(byId[second.id].partnerId, 'another-partner')
  assert.equal(getLocalAmenity(desk).reservedForPartnerId, null)
})

test('only a desk can be a partner desk', () => {
  resetLocalDevStore()
  const room = createLocalAmenity({ name: 'Room', type: 'meeting-room' })
  assert.throws(() => createLocalPartner({ name: '9AM Games', deskAmenityId: room }), /partner-desk-missing/)
  assert.equal(getLocalAmenity(room).reservedForPartnerId ?? null, null)
  assert.deepEqual(listLocalPartners(), [])
})

test('removing a partner leaves bookings the sync does not own alone', () => {
  resetLocalDevStore()
  const desk = createLocalAmenity({ name: 'Desk', type: 'desk' })
  const partner = createLocalPartner({ name: 'DiiD', deskAmenityId: desk })
  const [member] = listLocalMembers()
  updateLocalMember(member.id, { partnerId: partner.id })
  const start = new Date(Date.now() + 2 * 24 * 3600e3)
  const manual = createLocalBooking({
    memberId: member.id, amenityId: desk, status: 'approved', planType: 'fixed-desk',
    planGroupId: `partner_${member.id}`, startTime: start, endTime: new Date(start.getTime() + 9 * 3600e3)
  })
  deleteLocalPartner(partner.id)
  assert.equal(getLocalBooking(manual).status, 'approved')
})
