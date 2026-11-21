import test from 'node:test'
import assert from 'node:assert/strict'
import { isMemberEmailVerified, memberEmailFields } from '../src/utils/memberEmail.js'

test('only proof matching the displayed address is verified', () => {
  assert.equal(isMemberEmailVerified({ email: 'a@hub.dev', verifiedEmail: 'a@hub.dev' }), true)
  for (const member of [null, {}, { email: '' }, { email: 'a@hub.dev' },
    { email: 'a@hub.dev', emailVerified: true },
    { email: 'changed@hub.dev', verifiedEmail: 'a@hub.dev' }]) {
    assert.equal(isMemberEmailVerified(member), false)
  }
})

test('Auth sync replaces a legacy address and binds proof to the verified Auth email', () => {
  assert.deepEqual(memberEmailFields({ email: 'auth@hub.dev', emailVerified: true }, { email: 'old@hub.dev' }), {
    email: 'auth@hub.dev', verifiedEmail: 'auth@hub.dev'
  })
  assert.deepEqual(memberEmailFields({ email: 'auth@hub.dev', emailVerified: false }, { verifiedEmail: 'old@hub.dev' }), {
    email: 'auth@hub.dev', verifiedEmail: ''
  })
})

test('wallet contact emails stay editable and never inherit verification', () => {
  assert.deepEqual(memberEmailFields({ email: null, emailVerified: true }, { email: 'typed@hub.dev', verifiedEmail: 'typed@hub.dev' }), {
    email: 'typed@hub.dev', verifiedEmail: ''
  })
  assert.deepEqual(memberEmailFields({}), { email: '', verifiedEmail: '' })
})
