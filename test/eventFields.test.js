import test from 'node:test'
import assert from 'node:assert/strict'
import { EVENT_VIEWS, getVisibleFields, isWebLink, getEventVenueId, getVenuePayload, getEventFormPayload } from '../src/components/event/eventFields.js'

test('admin view shows every field, restricted ones included', () => {
  const fields = getVisibleFields('admin')
  for (const f of ['status', 'venue', 'revision', 'eventLink', 'organizer', 'attendees']) {
    assert.ok(fields.has(f), f)
  }
})

test('restricted fields never show outside views that allow them', () => {
  for (const name of Object.keys(EVENT_VIEWS)) {
    if (EVENT_VIEWS[name].allowRestricted) continue
    const fields = getVisibleFields(name)
    assert.ok(!fields.has('venue'), `${name} venue`)
    assert.ok(!fields.has('revision'), `${name} revision`)
  }
})

test('hidden fields are not visible', () => {
  const fields = getVisibleFields('member')
  for (const f of ['status', 'attendees']) assert.ok(!fields.has(f), f)
})

test('attendee counts only for admin and organizer', () => {
  const withAttendees = Object.keys(EVENT_VIEWS).filter(name => getVisibleFields(name).has('attendees'))
  assert.deepEqual(withAttendees.sort(), ['admin', 'organizer'])
})

test('isWebLink accepts only http(s)', () => {
  assert.equal(isWebLink('https://example.com'), true)
  assert.equal(isWebLink('HTTP://example.com'), true)
  assert.equal(isWebLink('javascript:alert(1)'), false)
  assert.equal(isWebLink(undefined), false)
})

test('getEventVenueId reads only requestedAmenityId', () => {
  assert.equal(getEventVenueId({ requestedAmenityId: 'r', linkedAmenityId: 'l' }), 'r')
  assert.equal(getEventVenueId({ linkedAmenityId: 'l' }), '')
  assert.equal(getEventVenueId({ requestedAmenityId: '' }), '')
  assert.equal(getEventVenueId(null), '')
})

test('getVenuePayload clears both venue fields when unticked', () => {
  const form = new Map([['amenityId', 'hall'], ['amenityNote', 'mic']])
  assert.deepEqual(getVenuePayload(form, true), { requestedAmenityId: 'hall', amenityNote: 'mic' })
  assert.deepEqual(getVenuePayload(form, false), { requestedAmenityId: '', amenityNote: '' })
})

test('getEventFormPayload clears optional fields and clamps capacity', () => {
  const form = new Map([['title', 'T'], ['description', 'D'], ['capacity', '999'], ['duration', ''], ['hostingProjects', '  '], ['eventLink', '']])
  const payload = getEventFormPayload(form, new Date('2026-11-01T11:00:00.000Z'), false)
  assert.equal(payload.capacity, 50)
  assert.equal(payload.duration, 60)
  assert.equal(payload.hostingProjects, '')
  assert.equal(payload.eventLink, '')
  assert.equal('waitlist' in payload, false)
})
