import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient } from '@tanstack/react-query'
import { registerFromEventCard, runFreshRegistration } from '../src/utils/eventRegistrationAction.js'

const availableEvent = (overrides = {}) => ({
  status: 'approved', date: new Date(Date.now() + 86400000), capacity: 2,
  attendees: [], ...overrides
})
const run = (loadEvent, register, isActive = () => true, queryClient = new QueryClient()) => runFreshRegistration({
  eventId: 'event-1', memberId: 'member-1', loadEvent, register, isActive, queryClient
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

test('a card click after a full redirect uses the server snapshot in both live lists', async t => {
  const client = new QueryClient()
  const open = t.mock.fn()
  globalThis.window = { open }
  t.after(() => { delete globalThis.window })
  const stale = availableEvent({ id: 'event-1', attendees: ['a'], eventLink: 'https://lu.ma/event' })
  const full = { ...stale, attendees: ['a', 'b'] }
  const noWrite = () => assert.fail('full event must not record attendance')
  const keys = [['approvedEvents'], ['upcomingEvents']]
  for (const key of keys) client.setQueryData(key, [stale])
  const pending = Promise.withResolvers()
  const olderRefetch = client.fetchQuery({ queryKey: ['upcomingEvents'], queryFn: () => pending.promise }).catch(() => {})

  assert.equal(await run(async () => full, noWrite, () => true, client), 'full')
  pending.resolve([stale])
  await olderRefetch
  for (const key of keys) {
    const [card] = client.getQueryData(key)
    assert.deepEqual(card.attendees, ['a', 'b'])
    await registerFromEventCard(card, 'member-1', noWrite)
  }
  assert.equal(open.mock.callCount(), keys.length)
})
