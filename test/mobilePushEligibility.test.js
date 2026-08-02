import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveMobilePushEligibility } from '../src/utils/mobilePushEligibility.js'

const eligible = (navigatorLike) => resolveMobilePushEligibility({
  windowAvailable: true,
  navigatorLike
})

test('allows phone user agents', () => {
  assert.equal(eligible({
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36'
  }), true)
  assert.equal(eligible({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/15E148 Safari/604.1'
  }), true)
})

test('rejects iPad and Android tablet user agents', () => {
  assert.equal(eligible({
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0) Mobile/15E148 Safari/604.1'
  }), false)
  assert.equal(eligible({
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Safari/537.36'
  }), false)
})

test('requires both UA Client Hints and a phone user agent', () => {
  assert.equal(eligible({
    userAgentData: { mobile: true },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Safari/537.36'
  }), false)
  assert.equal(eligible({
    userAgentData: { mobile: true },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36'
  }), true)
  assert.equal(eligible({
    userAgentData: { mobile: false },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36'
  }), false)
})

test('rejects server and missing navigator environments', () => {
  assert.equal(resolveMobilePushEligibility({
    windowAvailable: false,
    navigatorLike: { userAgentData: { mobile: true } }
  }), false)
  assert.equal(resolveMobilePushEligibility({
    windowAvailable: true,
    navigatorLike: null
  }), false)
})
