import test from 'node:test'
import assert from 'node:assert/strict'
import { EVENT_VIEWS, getVisibleFields, isWebLink, hasEventPage, getUnfamiliarLinkHost, getEventVenueId, getVenuePayload, getEventFormPayload } from '../src/components/event/eventFields.js'

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

test('hasEventPage only for an event with a web link', () => {
  assert.equal(hasEventPage({ eventLink: 'https://lu.ma/abc' }), true)
  assert.equal(hasEventPage({ eventLink: '' }), false)
  assert.equal(hasEventPage({ eventLink: 'javascript:alert(1)' }), false)
  assert.equal(hasEventPage({}), false)
  assert.equal(hasEventPage(undefined), false)
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

test('linkCheck is admin-only', () => {
  const withCheck = Object.keys(EVENT_VIEWS).filter(name => getVisibleFields(name).has('linkCheck'))
  assert.deepEqual(withCheck, ['admin'])
})

test('known platforms and their subdomains raise no caution', () => {
  assert.equal(getUnfamiliarLinkHost('https://lu.ma/abc'), '')
  assert.equal(getUnfamiliarLinkHost('https://events.LU.MA/abc'), '')
  assert.equal(getUnfamiliarLinkHost('https://www.meetup.com/x'), '')
  assert.equal(getUnfamiliarLinkHost(''), '')
  assert.equal(getUnfamiliarLinkHost(undefined), '')
})

test('unfamiliar sites are flagged by the host the browser loads', () => {
  assert.equal(getUnfamiliarLinkHost('https://evil.xyz/event'), 'evil.xyz')
  assert.equal(getUnfamiliarLinkHost('https://lu.ma.evil.com/x'), 'lu.ma.evil.com')
  assert.equal(getUnfamiliarLinkHost('https://notlu.ma/x'), 'notlu.ma')
  assert.equal(getUnfamiliarLinkHost('https://lu.ma@evil.com/x'), 'evil.com')
})

test('a known host that forwards to a link in its query is flagged', () => {
  assert.equal(getUnfamiliarLinkHost('https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.com'), 'l.facebook.com')
  assert.equal(getUnfamiliarLinkHost('https://www.youtube.com/redirect?q=http://evil.com'), 'www.youtube.com')
  assert.equal(getUnfamiliarLinkHost('https://lu.ma/x?next=//evil.com'), 'lu.ma')
})

test('odd spellings of a forwarded link are flagged where the browser would go', () => {
  const fb = 'https://l.facebook.com/l.php?u='
  for (const value of ['/\\evil.com', '\\\\evil.com', 'https:\\\\evil.com', '%20https://evil.com', 'ht%09tps://evil.com', '/%09/evil.com']) {
    assert.equal(getUnfamiliarLinkHost(fb + value), 'l.facebook.com', value)
  }
})

test('a forwarded link is followed through known hops', () => {
  const fb = 'https://l.facebook.com/l.php?u='
  assert.equal(getUnfamiliarLinkHost(fb + encodeURIComponent(fb + 'https://evil.com')), 'l.facebook.com')
  assert.equal(getUnfamiliarLinkHost(fb + encodeURIComponent('https://lu.ma/x')), '')
})

test('a query linking to another known platform stays known', () => {
  assert.equal(getUnfamiliarLinkHost('https://lu.ma/x?next=https://luma.com/y'), '')
  assert.equal(getUnfamiliarLinkHost('https://docs.google.com/forms/d/x/viewform?entry.1=https://x.com/me'), '')
  assert.equal(getUnfamiliarLinkHost('https://www.facebook.com/events/1?ref=https%3A%2F%2Fm.facebook.com'), '')
})

test('a known host with an ordinary query stays known', () => {
  assert.equal(getUnfamiliarLinkHost('https://lu.ma/abc?utm_source=x&tk=123'), '')
  assert.equal(getUnfamiliarLinkHost('https://www.facebook.com/events/1?ref=newsfeed'), '')
  assert.equal(getUnfamiliarLinkHost('https://lu.ma/abc?time=18:30&lang=en&x=https:/y'), '')
  assert.equal(getUnfamiliarLinkHost('https://lu.ma/abc?next=//lu.ma/def&mail=mailto:a@b.co'), '')
})

test('a link with no web host is flagged as typed', () => {
  assert.equal(getUnfamiliarLinkHost('javascript:alert(1)'), 'javascript:alert(1)')
  assert.equal(getUnfamiliarLinkHost('https://'), 'https://')
})
