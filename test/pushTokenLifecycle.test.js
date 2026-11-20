import test from 'node:test'
import assert from 'node:assert/strict'
import { anotherAccountNeedsPush, clearPushRegistration, revokePushSubscription } from '../src/services/pushTokenLifecycle.js'

test('only a different signed-in account can preserve a shared subscription', () => {
  const input = { uid: 'a', activeUid: 'b', state: 'in', preferenceEnabled: true, permission: 'granted' }
  assert.equal(anotherAccountNeedsPush(input), true)
  assert.equal(anotherAccountNeedsPush({ ...input, state: 'unknown' }), true)
  for (const overrides of [{ activeUid: null }, { activeUid: 'a' }, { state: 'out' },
    { preferenceEnabled: false }, { permission: 'denied' }]) {
    assert.equal(anotherAccountNeedsPush({ ...input, ...overrides }), false)
  }
})

test('failed device cleanup still deletes legacy and revokes before returning the error', async () => {
  const actions = []
  const failure = new Error('device delete refused')
  await assert.rejects(clearPushRegistration({
    deletes: [Promise.reject(failure), Promise.resolve().then(() => actions.push('legacy deleted'))],
    anotherAccountNeedsPush: async () => true,
    revoke: async () => actions.push('revoked')
  }), failure)
  assert.deepEqual(actions, ['legacy deleted', 'revoked'])
})

test('successful cleanup preserves another active account but revokes for logged-out accounts', async () => {
  let revoked = 0
  for (const activeUid of ['b', null]) {
    await clearPushRegistration({
      deletes: [Promise.resolve()],
      anotherAccountNeedsPush: async () => anotherAccountNeedsPush({
        uid: 'a', activeUid, state: 'in', preferenceEnabled: true, permission: 'granted'
      }),
      revoke: async () => { revoked += 1 }
    })
    assert.equal(revoked, activeUid ? 0 : 1)
  }
})

test('revocation uses only the existing subscription, never creating one', async () => {
  let unsubscribed = 0
  const registration = { pushManager: {
    getSubscription: async () => ({ unsubscribe: async () => { unsubscribed += 1; return true } }),
    subscribe: () => { assert.fail('revocation must not subscribe') }
  } }
  await revokePushSubscription(registration)
  assert.equal(unsubscribed, 1)
  registration.pushManager.getSubscription = async () => null
  await revokePushSubscription(registration)
  assert.equal(unsubscribed, 1)
})

test('failed browser revocation is surfaced instead of claiming push is off', async () => {
  await assert.rejects(revokePushSubscription({ pushManager: {
    getSubscription: async () => ({ unsubscribe: async () => false })
  } }), /Unable to revoke/)
})

test('offline deletes still revoke and finish logout cleanup within its deadline', async () => {
  let revoked = false
  await assert.rejects(clearPushRegistration({
    deletes: [new Promise(() => {})],
    anotherAccountNeedsPush: async () => false,
    revoke: async () => { revoked = true },
    timeoutMs: 5
  }), /timed out/)
  assert.equal(revoked, true)
})
