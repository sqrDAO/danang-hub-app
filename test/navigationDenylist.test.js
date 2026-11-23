import test from 'node:test'
import assert from 'node:assert/strict'
import { isDenylistedNavigation } from '../src/utils/navigationDenylist.js'

test('OAuth endpoints, discovery docs and Firebase paths skip the app shell', () => {
  for (const path of ['/__/auth/handler', '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource/mcp', '/oauth/authorize', '/oauth/token',
    '/oauth/consentx', '/oauth/consent-evil', '/oauth/authorize?client_id=x']) {
    assert.equal(isDenylistedNavigation(path), true, path)
  }
})

test('SPA routes, including the consent page, keep the shell fallback', () => {
  for (const path of ['/', '/member/bookings', '/oauth/consent', '/oauth/consent/', '/oauth/consent?request=abc', '/login']) {
    assert.equal(isDenylistedNavigation(path), false, path)
  }
})
