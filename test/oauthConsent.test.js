import test from 'node:test'
import assert from 'node:assert/strict'
import { consentError, consentErrorKind, consentLoginPath, consentPath, isConsentRequestId } from '../src/utils/oauthConsent.js'
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

test('consent-action errors map to what the consent page shows', () => {
  const kind = (body) => consentErrorKind(consentError(body))
  assert.equal(kind({ error: 'unauthenticated', reason: 'unverified' }), 'unverified')
  assert.equal(kind({ error: 'unauthenticated', reason: 'disabled' }), 'failed')
  assert.equal(kind({ error: 'unauthenticated' }), 'signIn')
  assert.equal(kind({ error: 'permission-denied', reason: 'browser' }), 'otherBrowser')
  assert.equal(kind({ error: 'permission-denied', reason: 'origin' }), 'failed')
  assert.equal(kind({ error: 'not-found' }), 'expired')
  assert.equal(kind({ error: 'invalid-argument' }), 'invalid')
  assert.equal(kind({}), 'failed', 'a non-JSON error page')
  assert.equal(consentErrorKind(new TypeError('Failed to fetch')), 'failed')
})
