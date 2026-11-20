import test from 'node:test'
import assert from 'node:assert/strict'
import { clearPushRegistration, revokePushSubscription } from '../src/services/pushTokenLifecycle.js'

test('failed device cleanup reports successful revoke without restoring On', async () => {
  let restored = false
  const failure = new Error('device delete refused')
  await assert.rejects(clearPushRegistration({
    deletes: [Promise.reject(failure)], revoke: async () => {},
    onRevokeFailed: () => { restored = true }
  }), (error) => {
    assert.equal(error.subscriptionRevoked, true)
    assert.equal(error.revocationFailed, false)
    assert.equal(error.cause, failure)
    return true
  })
  assert.equal(restored, false)
})

test('offline deletes leave Off when revocation succeeded', async () => {
  let restored = false
  await assert.rejects(clearPushRegistration({
    deletes: [new Promise(() => {})], revoke: async () => {}, timeoutMs: 5,
    onRevokeFailed: () => { restored = true }
  }), (error) => error.subscriptionRevoked && !error.revocationFailed)
  assert.equal(restored, false)
})

test('revoke failure is distinguished from a deletion failure and may restore On', async () => {
  let restored = false
  await assert.rejects(clearPushRegistration({
    deletes: [Promise.resolve()], revoke: async () => { throw new Error('unsubscribe failed') },
    onRevokeFailed: () => { restored = true }
  }), (error) => !error.subscriptionRevoked && error.revocationFailed)
  assert.equal(restored, true)
})

test('a pending revoke is bounded but is not reported as successful or failed', async () => {
  let restored = false
  await assert.rejects(clearPushRegistration({
    deletes: [], revoke: () => new Promise(() => {}), timeoutMs: 5,
    onRevokeFailed: () => { restored = true }
  }), (error) => !error.subscriptionRevoked && !error.revocationFailed)
  assert.equal(restored, false)
})

test('revocation never creates a subscription and detects a refused unsubscribe', async () => {
  const registration = { pushManager: {
    getSubscription: async () => null,
    subscribe: () => { assert.fail('must not subscribe') }
  } }
  await revokePushSubscription(registration)
  registration.pushManager.getSubscription = async () => ({ unsubscribe: async () => false })
  await assert.rejects(revokePushSubscription(registration), { code: 'push/revoke-failed' })
})
