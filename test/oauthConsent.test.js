import test from 'node:test'
import assert from 'node:assert/strict'
import { consentErrorKind, consentLoginPath, consentPath, isConsentRequestId } from '../src/utils/oauthConsent.js'
import { toSafeRedirectPath } from '../src/utils/safeRedirect.js'

const id = 'a1'.repeat(16)

test('the consent request survives the trip through /login?redirect=', () => {
  const login = new URL(consentLoginPath(id), 'https://app.danangblockchainhub.com')
  assert.equal(login.pathname, '/login')
  assert.deepEqual([...login.searchParams.keys()], ['redirect'], 'the inner ?request= is encoded, not a second param')
  const back = toSafeRedirectPath(login.searchParams.get('redirect'))
  assert.equal(back, consentPath(id))
  assert.equal(new URL(back, 'https://x.test').searchParams.get('request'), id)
})

test('only 32-hex request ids reach the callable', () => {
  assert.equal(isConsentRequestId(id), true)
  for (const bad of [null, '', 'A1'.repeat(16), id + '0', '../x', id.slice(1)]) assert.equal(isConsentRequestId(bad), false)
})

test('callable errors map to what the consent page shows', () => {
  assert.equal(consentErrorKind({ code: 'functions/unauthenticated', details: { reason: 'unverified' } }), 'unverified')
  assert.equal(consentErrorKind({ code: 'functions/unauthenticated', details: { reason: 'disabled' } }), 'failed')
  assert.equal(consentErrorKind({ code: 'functions/unauthenticated' }), 'signIn')
  assert.equal(consentErrorKind({ code: 'functions/not-found' }), 'expired')
  assert.equal(consentErrorKind({ code: 'functions/invalid-argument' }), 'invalid')
  assert.equal(consentErrorKind(new Error('offline')), 'failed')
})
