import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveBookingDeepLink } from '../src/utils/bookingDeepLink.js'

const amenities = [
  { id: 'meeting-room', type: 'meeting-room', isAvailable: true },
  { id: 'legacy-room', type: 'meeting-room', isAvailable: false },
  { id: 'event hall/1', type: 'event-space', isAvailable: true },
  { id: 'legacy-hall', type: 'event-space', isAvailable: false },
]

test('selects an available non-event amenity for standard booking', () => {
  assert.deepEqual(resolveBookingDeepLink(amenities, 'meeting-room'), {
    amenity: amenities[0],
  })
})

test('rejects missing and unavailable amenity deep links', () => {
  assert.equal(resolveBookingDeepLink(amenities, 'missing'), null)
  assert.equal(resolveBookingDeepLink(amenities, 'legacy-room'), null)
  assert.equal(resolveBookingDeepLink(amenities, 'legacy-hall'), null)
})

test('redirects an available event space to event creation', () => {
  assert.deepEqual(resolveBookingDeepLink(amenities, 'event hall/1'), {
    redirectTo: '/member/events?action=create&amenityId=event%20hall%2F1',
  })
})
