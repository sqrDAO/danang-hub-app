import test from 'node:test'
import assert from 'node:assert/strict'
import { getEmailStatus, verifyCooldownSecondsLeft, verifyErrorKey } from '../src/utils/emailVerification.js'

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

test('a throttled send gets its own message', () => {
  assert.equal(verifyErrorKey({ code: 'auth/too-many-requests' }), 'profile.verifyEmailTooMany')
  assert.equal(verifyErrorKey({ code: 'auth/network-request-failed' }), 'profile.verifyEmailFailed')
  assert.equal(verifyErrorKey(undefined), 'profile.verifyEmailFailed')
})
