import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDesktopNotificationSoundEligibility } from '../src/utils/desktopNotificationSound.js'

const eligible = (navigatorLike) => resolveDesktopNotificationSoundEligibility({
  windowAvailable: true,
  navigatorLike
})

test('allows desktop browser sessions to play the notification sound', () => {
  assert.equal(eligible({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15',
    maxTouchPoints: 0
  }), true)
})

test('rejects phone and tablet browser sessions', () => {
  assert.equal(eligible({
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36'
  }), false)
  assert.equal(eligible({
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0) Mobile/15E148 Safari/604.1'
  }), false)
  assert.equal(eligible({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
    maxTouchPoints: 5
  }), false)
})

test('rejects server and missing navigator environments', () => {
  assert.equal(resolveDesktopNotificationSoundEligibility({
    windowAvailable: false,
    navigatorLike: { userAgent: 'Mozilla/5.0' }
  }), false)
  assert.equal(resolveDesktopNotificationSoundEligibility({
    windowAvailable: true,
    navigatorLike: null
  }), false)
})
