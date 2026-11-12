import test from 'node:test'
import assert from 'node:assert/strict'
import {
  changeEmailErrorKey,
  formatCooldown,
  getEmailStatus,
  readVerifySentAt,
  recordVerifySent,
  verifyCooldownSecondsLeft,
  verifyErrorKey
} from '../src/utils/emailVerification.js'

test('a verified Auth email can receive event emails', () => {
  assert.equal(getEmailStatus({ email: 'a@b.co', emailVerified: true }), 'verified')
})

test('an unverified password account must verify first', () => {
  assert.equal(getEmailStatus({ email: 'a@b.co', emailVerified: false }), 'unverified')
})

test('a wallet account has no Auth email', () => {
  assert.equal(getEmailStatus({ email: null, emailVerified: false }), 'none')
})

test('no signed-in user counts as no email', () => {
  assert.equal(getEmailStatus(null), 'none')
})

test('the local dev user can use the email switch', async () => {
  const { getLocalDevUser } = await import('../src/utils/localDevMode.js')
  assert.equal(getEmailStatus(getLocalDevUser()), 'verified')
})

test('the cooldown counts down from the last send and ends at 0', () => {
  const sentAt = 1_000_000
  assert.equal(verifyCooldownSecondsLeft(sentAt, sentAt), 60)
  assert.equal(verifyCooldownSecondsLeft(sentAt, sentAt + 59_001), 1)
  assert.equal(verifyCooldownSecondsLeft(sentAt, sentAt + 60_000), 0)
  assert.equal(verifyCooldownSecondsLeft(0, sentAt), 0)
})

test('the countdown reads as m:ss', () => {
  assert.equal(formatCooldown(60), '1:00')
  assert.equal(formatCooldown(45), '0:45')
  assert.equal(formatCooldown(5), '0:05')
})

test('a throttled send gets its own message', () => {
  assert.equal(verifyErrorKey({ code: 'auth/too-many-requests' }), 'profile.verifyEmailTooMany')
  assert.equal(verifyErrorKey({ code: 'auth/network-request-failed' }), 'profile.verifyEmailFailed')
  assert.equal(verifyErrorKey(undefined), 'profile.verifyEmailFailed')
})

test('a send remembers when the link went, per account', () => {
  const store = new Map()
  globalThis.window = {
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) }
  }
  try {
    recordVerifySent('uid-a', 1_000)
    assert.equal(readVerifySentAt('uid-a'), 1_000)
    assert.equal(readVerifySentAt('uid-b'), 0)
  } finally {
    delete globalThis.window
  }
})

test('without storage, nothing counts as sent', () => {
  assert.equal(readVerifySentAt('uid-a'), 0)
})

test('change-email errors map to their own messages, others to a generic one', () => {
  assert.equal(changeEmailErrorKey({ code: 'auth/requires-recent-login' }), 'profile.changeEmailRecentLogin')
  assert.equal(changeEmailErrorKey({ code: 'auth/email-already-in-use' }), 'profile.changeEmailInUse')
  assert.equal(changeEmailErrorKey({ code: 'auth/invalid-email' }), 'profile.changeEmailInvalid')
  assert.equal(changeEmailErrorKey({ code: 'auth/too-many-requests' }), 'profile.verifyEmailTooMany')
  assert.equal(changeEmailErrorKey({ code: 'auth/network-request-failed' }), 'profile.changeEmailFailed')
  assert.equal(changeEmailErrorKey(undefined), 'profile.changeEmailFailed')
})
