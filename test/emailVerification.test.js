import test from 'node:test'
import assert from 'node:assert/strict'
import { getEmailStatus } from '../src/utils/emailVerification.js'

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
