import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveNeedsHomeScreenInstall } from '../src/utils/iosInstallHint.js'

const IPHONE_18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) Mobile/15E148 Safari/604.1'

test('iPhone browser tab on iOS 16.4+ needs install', () => {
  assert.equal(resolveNeedsHomeScreenInstall({ userAgent: IPHONE_18 }), true)
  assert.equal(resolveNeedsHomeScreenInstall({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) Mobile/15E148 Safari/604.1'
  }), true)
  assert.equal(resolveNeedsHomeScreenInstall({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/140.0 Mobile/15E148 Safari/604.1'
  }), true)
})

test('installed iPhone app does not need install', () => {
  assert.equal(resolveNeedsHomeScreenInstall({ userAgent: IPHONE_18, standalone: true }), false)
})

test('iOS before 16.4 cannot get web push at all', () => {
  assert.equal(resolveNeedsHomeScreenInstall({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) Mobile/15E148 Safari/604.1'
  }), false)
  assert.equal(resolveNeedsHomeScreenInstall({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) Mobile/15E148 Safari/604.1'
  }), false)
})

test('iPad, Android and desktop are out of scope', () => {
  assert.equal(resolveNeedsHomeScreenInstall({
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'
  }), false)
  assert.equal(resolveNeedsHomeScreenInstall({
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36'
  }), false)
  assert.equal(resolveNeedsHomeScreenInstall({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15'
  }), false)
  assert.equal(resolveNeedsHomeScreenInstall(), false)
})
