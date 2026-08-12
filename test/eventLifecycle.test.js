import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  getRevision,
  normalizeEditPayload,
  getBookingWindow,
  getNotificationSubjectId
} = require('../functions/eventLifecycle.js')

const now = new Date('2026-08-12T00:00:00.000Z')
const future = new Date('2026-08-20T11:00:00.000Z')
const event = {
  date: { toDate: () => future },
  attendees: ['member-a', 'member-b'],
  revision: 3
}

const payload = {
  title: 'Web3 workshop',
  description: 'Learn together.',
  date: '2026-08-22T11:00:00.000Z',
  duration: 90,
  capacity: 10,
  bannerUrl: 'https://example.com/banner.png',
  hostingProjects: '',
  eventLink: '',
  requestedAmenityId: 'main-hall',
  amenityNote: ''
}

test('legacy events normalize to revision one', () => {
  assert.equal(getRevision({}), 1)
  assert.equal(getRevision({ revision: 0 }), 1)
  assert.equal(getRevision(event), 3)
})

test('organizer edit payload keeps only editable normalized values', () => {
  const result = normalizeEditPayload(payload, event, now)
  assert.equal(result.title, payload.title)
  assert.equal(result.date.toISOString(), payload.date)
  assert.equal(result.hostingProjects, null)
  assert.equal(result.eventLink, null)
  assert.equal(result.requestedAmenityId, 'main-hall')
})

test('protected fields, past dates, and under-capacity edits are rejected', () => {
  assert.throws(
    () => normalizeEditPayload({ ...payload, status: 'approved' }, event, now),
    /protected fields/
  )
  assert.throws(
    () => normalizeEditPayload({ ...payload, date: '2026-08-11T00:00:00.000Z' }, event, now),
    /future/
  )
  assert.throws(
    () => normalizeEditPayload({ ...payload, capacity: 1 }, event, now),
    /attendee count/
  )
})

test('booking window has one hour setup and teardown around event duration', () => {
  const window = getBookingWindow('2026-08-22T11:00:00.000Z', 90)
  assert.equal(window.startTime.toISOString(), '2026-08-22T10:00:00.000Z')
  assert.equal(window.endTime.toISOString(), '2026-08-22T13:30:00.000Z')
})

test('notification subjects distinguish review revisions and transitions', () => {
  assert.equal(getNotificationSubjectId('event-1', 2, 'pending'), 'event-1_2_pending')
  assert.notEqual(
    getNotificationSubjectId('event-1', 2, 'approved'),
    getNotificationSubjectId('event-1', 3, 'approved')
  )
})
