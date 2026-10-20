import test from 'node:test'
import assert from 'node:assert/strict'
import { validateEventSpaceTime } from '../src/utils/eventSpaceHours.js'

// 2026-11-04 is a Wednesday, 2026-11-07 a Saturday (Hub time).
const WEDNESDAY = '2026-11-04'
const SATURDAY = '2026-11-07'
const keyOf = (result) => result?.key.split('.').pop() ?? null

test('without a venue only the Hub-wide policy applies', () => {
  assert.equal(validateEventSpaceTime(`${WEDNESDAY}T21:00`, 60), null)
  assert.equal(keyOf(validateEventSpaceTime(`${WEDNESDAY}T10:00`, 60)), 'weekdayHoursError')
  assert.equal(keyOf(validateEventSpaceTime(`${SATURDAY}T08:30`, 60)), 'weekendHoursError')
  assert.equal(keyOf(validateEventSpaceTime(`${SATURDAY}T21:30`, 60)), 'endTimeError')
})

test('a venue closing early narrows the window', () => {
  const hall = { endHour: 20 }
  assert.deepEqual(validateEventSpaceTime(`${WEDNESDAY}T21:00`, 60, hall), {
    key: 'memberEvents.modal.venueHoursError', params: { start: 18, end: 20 }
  })
  assert.equal(validateEventSpaceTime(`${WEDNESDAY}T18:00`, 120, hall), null)
})

test('a venue start hour narrows weekends only', () => {
  const hall = { startHour: 10 }
  assert.equal(keyOf(validateEventSpaceTime(`${SATURDAY}T09:30`, 60, hall)), 'venueHoursError')
  assert.equal(validateEventSpaceTime(`${WEDNESDAY}T18:00`, 60, hall), null)
})

test('venue settings never widen the policy window', () => {
  const hall = { startHour: 6, endHour: 23 }
  assert.equal(keyOf(validateEventSpaceTime(`${SATURDAY}T08:00`, 60, hall)), 'weekendHoursError')
  assert.equal(keyOf(validateEventSpaceTime(`${SATURDAY}T21:30`, 60, hall)), 'endTimeError')
})

test('venue days and availability are enforced', () => {
  assert.equal(keyOf(validateEventSpaceTime(`${WEDNESDAY}T19:00`, 60, { availableDays: [0, 6] })), 'venueDayError')
  assert.equal(validateEventSpaceTime(`${SATURDAY}T19:00`, 60, { availableDays: [0, 6] }), null)
  assert.equal(keyOf(validateEventSpaceTime(`${SATURDAY}T19:00`, 60, { isAvailable: false })), 'venueUnavailableError')
})

test('a Hub closure blocks the day', () => {
  assert.equal(keyOf(validateEventSpaceTime('2026-08-31T19:00', 60)), 'hubClosedError')
})
