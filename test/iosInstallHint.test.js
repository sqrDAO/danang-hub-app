import test from 'node:test'
import assert from 'node:assert/strict'
import { getHomeScreenInstallHint, resolveHomeScreenInstallHint } from '../src/utils/iosInstallHint.js'

const IPHONE_18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) Mobile/15E148 Safari/604.1'
const hint = (userAgent, extra = {}) => resolveHomeScreenInstallHint({ userAgent, phone: true, ...extra })

test('iPhone browser tab on iOS 16.4+ gets the install steps', () => {
  assert.equal(hint(IPHONE_18), 'install')
  assert.equal(hint('Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) Mobile/15E148 Safari/604.1'), 'install')
  assert.equal(hint('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/140.0 Mobile/15E148 Safari/604.1'), 'install')
})

test('in-app browsers are told to open Safari instead', () => {
  const inApp = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Mobile/15E148 Zalo iOS/526 ZaloTheme/light ZaloLanguage/vn',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0]',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/500.0]',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Mobile/15E148 Instagram 380.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Mobile/15E148 Safari Line/15.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Mobile/15E148 MicroMessenger/8.0.50'
  ]
  inApp.forEach((userAgent) => assert.equal(hint(userAgent), 'safari', userAgent))
})

test('installed iPhone app needs no hint', () => {
  assert.equal(hint(IPHONE_18, { standalone: true }), null)
})

test('iOS before 16.4 cannot get web push at all', () => {
  assert.equal(hint('Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) Mobile/15E148 Safari/604.1'), null)
  assert.equal(hint('Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) Mobile/15E148 Safari/604.1'), null)
})

test('iPad, Android, desktop and non-phones are out of scope', () => {
  assert.equal(hint('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'), null)
  assert.equal(hint('Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36'), null)
  assert.equal(hint('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15'), null)
  assert.equal(resolveHomeScreenInstallHint({ userAgent: IPHONE_18, phone: false }), null)
  assert.equal(resolveHomeScreenInstallHint(), null)
})

const withBrowser = ({ standalone, displayModeStandalone }, run) => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: IPHONE_18, standalone },
    configurable: true
  })
  globalThis.window = { matchMedia: () => ({ matches: displayModeStandalone }) }
  try {
    run()
  } finally {
    delete globalThis.window
    if (saved) Object.defineProperty(globalThis, 'navigator', saved)
    else delete globalThis.navigator
  }
}

test('browser wrapper reads either installed-app signal', () => {
  withBrowser({ standalone: false, displayModeStandalone: false }, () => {
    assert.equal(getHomeScreenInstallHint(), 'install')
  })
  withBrowser({ standalone: true, displayModeStandalone: false }, () => {
    assert.equal(getHomeScreenInstallHint(), null)
  })
  withBrowser({ standalone: undefined, displayModeStandalone: true }, () => {
    assert.equal(getHomeScreenInstallHint(), null)
  })
})
