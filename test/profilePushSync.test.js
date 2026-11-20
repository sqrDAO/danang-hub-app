import test from 'node:test'
import assert from 'node:assert/strict'
import { settleProfilePushSync } from '../src/utils/profilePushSync.js'

test('successful revoke with failed document cleanup warns and lets profile save continue', async () => {
  const calls = []
  const error = { code: 'push/cleanup-failed', subscriptionRevoked: true }
  await settleProfilePushSync({
    sync: Promise.reject(error), touched: true,
    onWarning: warning => { assert.equal(warning, error); calls.push('warning') },
    readPermission: () => 'granted', onPermissionChange: value => calls.push(value)
  })
  calls.push('save-profile')
  assert.deepEqual(calls, ['warning', 'granted', 'save-profile'])
})

test('failed revoke still prevents save and refreshes permission state', async () => {
  let permission
  await assert.rejects(settleProfilePushSync({
    sync: Promise.reject({ code: 'push/cleanup-failed', subscriptionRevoked: false }), touched: true,
    onWarning: () => assert.fail('unsafe to treat failed revoke as a warning'),
    readPermission: () => 'granted', onPermissionChange: value => { permission = value }
  }), { code: 'push/cleanup-failed' })
  assert.equal(permission, 'granted')
})

test('denied permission refreshes Profile help even when enabling fails', async () => {
  let permission
  await assert.rejects(settleProfilePushSync({
    sync: Promise.reject({ code: 'push/permission-denied' }), touched: true,
    onWarning: () => assert.fail('denial is not cleanup'),
    readPermission: () => 'denied', onPermissionChange: value => { permission = value }
  }), { code: 'push/permission-denied' })
  assert.equal(permission, 'denied')
})
