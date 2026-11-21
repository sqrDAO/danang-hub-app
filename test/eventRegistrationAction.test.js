import test from 'node:test'
import assert from 'node:assert/strict'
import { runFreshRegistration } from '../src/utils/eventRegistrationAction.js'

const availableEvent = (overrides = {}) => ({
  status: 'approved', date: new Date(Date.now() + 86400000), capacity: 2,
  attendees: [], ...overrides
})
const run = (loadEvent, register, isActive = () => true) => runFreshRegistration({
  eventId: 'event-1', memberId: 'member-1', loadEvent, register, isActive
})

test('registration waits for a fresh event read before writing', async () => {
  const pending = Promise.withResolvers()
  const writes = []
  const action = run(id => { assert.equal(id, 'event-1'); return pending.promise }, payload => writes.push(payload))
  assert.deepEqual(writes, [])
  pending.resolve(availableEvent())
  assert.equal(await action, 'registered')
  assert.deepEqual(writes, [{ eventId: 'event-1', memberId: 'member-1' }])
})

test('fresh full event blocks registration with or without an external page', async () => {
  for (const eventLink of ['', 'https://lu.ma/event']) {
    const outcome = await run(async () => availableEvent({ attendees: ['a', 'b'], eventLink }), () => assert.fail('must not write'))
    assert.equal(outcome, 'full')
  }
})

test('missing, unavailable, past, invalid-date and registered events do not write', async () => {
  const cases = [
    [null, 'missing'],
    [availableEvent({ status: 'pending' }), 'unavailable'],
    [availableEvent({ status: 'rejected' }), 'unavailable'],
    [availableEvent({ date: new Date(0) }), 'unavailable'],
    [availableEvent({ date: undefined }), 'unavailable'],
    [availableEvent({ attendees: ['member-1'] }), 'alreadyRegistered']
  ]
  for (const [event, expected] of cases) {
    assert.equal(await run(async () => event, () => assert.fail('must not write')), expected)
  }
})

test('failed server read fails closed without a cached fallback', async () => {
  assert.equal(await run(async () => { throw new Error('offline') }, () => assert.fail('must not write')), 'failed')
})

test('navigation or account change ignores a late successful read', async () => {
  const pending = Promise.withResolvers()
  let active = true
  const action = run(() => pending.promise, () => assert.fail('must not write'), () => active)
  active = false
  pending.resolve(availableEvent())
  assert.equal(await action, 'cancelled')
})

test('abandoned failed read is cancelled rather than reporting an error', async () => {
  assert.equal(await run(async () => { throw new Error('offline') }, () => assert.fail('must not write'), () => false), 'cancelled')
})
