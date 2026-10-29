import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  PARTNER_DESK_MOVED_REASON,
  PARTNER_REMOVED_REASON,
  deskCapacity,
  partnerDeskBookingId,
  partnerDeskDays,
  planPartnerDeskSync
} = require('../functions/partnerDesks.js')

const HOUR = 60 * 60 * 1000
// Hub midnight, Monday 2030-01-07 (Asia/Ho_Chi_Minh, UTC+7).
const MONDAY = Date.UTC(2030, 0, 7) - 7 * HOUR

const desk = { type: 'desk', capacity: 2 }
const amenities = new Map([['desk-1', desk], ['desk-2', { type: 'desk', capacity: 1 }], ['room', { type: 'meeting-room' }]])
const partners = [{ id: 'p-9am', deskAmenityId: 'desk-1' }, { id: 'p-diid' }]
const days = partnerDeskDays(MONDAY, MONDAY, 7)
const plan = (overrides = {}) => planPartnerDeskSync({
  members: [{ id: 'm1', partnerId: 'p-9am' }],
  partners,
  amenities,
  bookings: [],
  days,
  nowMs: MONDAY,
  ...overrides
})
const partnerDay = (uid, amenityId, dayKey, extra = {}) => ({
  id: partnerDeskBookingId(uid, amenityId, dayKey),
  memberId: uid,
  amenityId,
  planType: 'partner-desk',
  planGroupId: `partner_${uid}`,
  status: 'approved',
  startTime: days.find(d => d.dayKey === dayKey).start,
  endTime: days.find(d => d.dayKey === dayKey).end,
  ...extra
})

test('covers Mon–Fri 09:00–18:00 hub time and skips weekends', () => {
  assert.deepEqual(days.map(d => d.dayKey), ['20300107', '20300108', '20300109', '20300110', '20300111'])
  assert.equal(days[0].start.toISOString(), '2030-01-07T02:00:00.000Z')
  assert.equal(days[0].end.toISOString(), '2030-01-07T11:00:00.000Z')
})

test('skips a day that has already ended', () => {
  const evening = MONDAY + 19 * HOUR
  assert.equal(partnerDeskDays(MONDAY, evening, 7)[0].dayKey, '20300108')
  assert.equal(partnerDeskDays(MONDAY, MONDAY + 12 * HOUR, 7)[0].dayKey, '20300107')
})

test('skips hub closure days', () => {
  // Independence Day closure: 2026-08-31 (Mon) – 2026-09-02 (Wed).
  const closureMonday = Date.UTC(2026, 7, 31) - 7 * HOUR
  const keys = partnerDeskDays(closureMonday, closureMonday, 5).map(d => d.dayKey)
  assert.deepEqual(keys, ['20260903', '20260904'])
})

test('books every working day for an attached member', () => {
  const { create, reactivate, cancel } = plan()
  assert.equal(create.length, 5)
  assert.deepEqual(reactivate, [])
  assert.deepEqual(cancel, [])
  assert.equal(create[0].id, 'pd_m1_desk-1_20300107')
  assert.equal(create[0].partnerId, 'p-9am')
})

test('books nothing for a partner without a desk, or with a non-desk amenity', () => {
  assert.equal(plan({ members: [{ id: 'm1', partnerId: 'p-diid' }] }).create.length, 0)
  assert.equal(plan({ partners: [{ id: 'p-9am', deskAmenityId: 'room' }] }).create.length, 0)
  assert.equal(plan({ partners: [] }).create.length, 0)
})

test('is idempotent: existing days are not created again', () => {
  const bookings = days.map(d => partnerDay('m1', 'desk-1', d.dayKey))
  assert.deepEqual(plan({ bookings }), { create: [], reactivate: [], cancel: [] })
})

test('never recreates a day the member cancelled', () => {
  const bookings = [partnerDay('m1', 'desk-1', '20300108', { status: 'cancelled' })]
  const { create, reactivate } = plan({ bookings })
  assert.equal(create.some(b => b.id === bookings[0].id), false)
  assert.deepEqual(reactivate, [])
})

test('never reactivates a day cancelled for a hub closure', () => {
  const bookings = [partnerDay('m1', 'desk-1', '20300108', { status: 'cancelled', cancelledReason: 'hub-closure-x' })]
  assert.deepEqual(plan({ bookings }).reactivate, [])
})

test('reactivates days the sync cancelled when the member is re-attached', () => {
  const bookings = [partnerDay('m1', 'desk-1', '20300108', { status: 'cancelled', cancelledReason: PARTNER_REMOVED_REASON })]
  const { create, reactivate } = plan({ bookings })
  assert.deepEqual(reactivate, [bookings[0].id])
  assert.equal(create.length, 4)
})

test('cancels future days when a member is detached', () => {
  const bookings = [
    partnerDay('m1', 'desk-1', '20300107'),
    partnerDay('m1', 'desk-1', '20300108', { status: 'pending' }),
    partnerDay('m1', 'desk-1', '20300109', { status: 'checked-in' }),
    partnerDay('m1', 'desk-1', '20300110', { status: 'cancelled' })
  ]
  const { create, cancel } = plan({ members: [], bookings })
  assert.deepEqual(cancel, [
    { id: bookings[0].id, reason: PARTNER_REMOVED_REASON },
    { id: bookings[1].id, reason: PARTNER_REMOVED_REASON }
  ])
  assert.equal(create.length, 0)
})

test('moves a member to the new desk when the partner desk changes', () => {
  const bookings = days.map(d => partnerDay('m1', 'desk-1', d.dayKey))
  const { create, cancel } = plan({ partners: [{ id: 'p-9am', deskAmenityId: 'desk-2' }], bookings })
  assert.equal(cancel.length, 5)
  // Moved, not removed: the notice path stays silent for this reason.
  assert.ok(cancel.every(c => c.reason === PARTNER_DESK_MOVED_REASON))
  assert.equal(create.length, 5)
  assert.ok(create.every(b => b.amenityId === 'desk-2'))
})

test('skips days with no free seat and counts seats it books in the same run', () => {
  const other = { id: 'x', amenityId: 'desk-1', status: 'approved', startTime: days[0].start, endTime: days[0].end }
  const members = [{ id: 'm1', partnerId: 'p-9am' }, { id: 'm2', partnerId: 'p-9am' }]
  const { create } = plan({ members, bookings: [other] })
  // Capacity 2: Monday has one seat left, so only m1 gets it.
  assert.equal(create.filter(b => b.id.endsWith('20300107')).length, 1)
  assert.equal(create.length, 9)
})

test('ignores cancelled bookings and non-overlapping slots when counting seats', () => {
  const morning = new Date(days[0].start.getTime() - 3 * HOUR)
  const bookings = [
    { id: 'a', amenityId: 'desk-2', status: 'cancelled', startTime: days[0].start, endTime: days[0].end },
    { id: 'b', amenityId: 'desk-2', status: 'approved', startTime: morning, endTime: days[0].start }
  ]
  const { create } = plan({ partners: [{ id: 'p-9am', deskAmenityId: 'desk-2' }], bookings })
  assert.equal(create.length, 5)
})

test('leaves a day already under way when a member is detached', () => {
  const bookings = [partnerDay('m1', 'desk-1', '20300107'), partnerDay('m1', 'desk-1', '20300108')]
  const { cancel } = plan({ members: [], bookings, nowMs: MONDAY + 10 * HOUR })
  assert.deepEqual(cancel.map(c => c.id), [bookings[1].id])
})

test('never touches partner-desk plans it did not create', () => {
  const manual = { ...partnerDay('m1', 'desk-1', '20300108'), id: 'manual-1', planGroupId: 'random-group' }
  assert.deepEqual(plan({ members: [], bookings: [manual] }).cancel, [])
})

test('does not give a member a second seat on a day they already hold a desk', () => {
  const fixedDay = { id: 'f', memberId: 'm1', amenityId: 'desk-2', planType: 'fixed-desk', status: 'approved', startTime: days[1].start, endTime: days[1].end }
  const { create } = plan({ bookings: [fixedDay] })
  assert.equal(create.some(b => b.id.endsWith('20300108')), false)
  assert.equal(create.length, 4)
})

test('a meeting-room booking does not count as holding a desk', () => {
  const meeting = { id: 'r', memberId: 'm1', amenityId: 'room', status: 'approved', startTime: days[1].start, endTime: days[1].end }
  assert.equal(plan({ bookings: [meeting] }).create.length, 5)
})

test('books nothing on a switched-off desk, and only on its available days', () => {
  const off = new Map(amenities).set('desk-1', { ...desk, isAvailable: false })
  assert.equal(plan({ amenities: off }).create.length, 0)
  const monWed = new Map(amenities).set('desk-1', { ...desk, availableDays: [1, 3] })
  assert.deepEqual(plan({ amenities: monWed }).create.map(b => b.id.slice(-8)), ['20300107', '20300109'])
})

test('a switched-off desk does not cancel days already booked', () => {
  const off = new Map(amenities).set('desk-1', { ...desk, isAvailable: false })
  const bookings = [partnerDay('m1', 'desk-1', '20300108')]
  assert.deepEqual(plan({ amenities: off, bookings }).cancel, [])
})

test('reactivates days cancelled by a desk move when the desk moves back', () => {
  const bookings = [partnerDay('m1', 'desk-1', '20300108', { status: 'cancelled', cancelledReason: PARTNER_DESK_MOVED_REASON })]
  assert.deepEqual(plan({ bookings }).reactivate, [bookings[0].id])
})

test('reads desk capacity the same way as the conflict check', () => {
  assert.equal(deskCapacity({ capacity: 3 }), 3)
  assert.equal(deskCapacity({ capacity: '3' }), 1)
  assert.equal(deskCapacity({ capacity: 0 }), 1)
  assert.equal(deskCapacity(null), 1)
})
