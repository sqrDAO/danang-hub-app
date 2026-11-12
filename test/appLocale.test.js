import test from 'node:test'
import assert from 'node:assert/strict'
import { appLocale } from '../src/utils/appLocale.js'

test('maps Vietnamese to vi-VN', () => {
  assert.equal(appLocale('vi'), 'vi-VN')
  assert.equal(appLocale('vi-VN'), 'vi-VN')
})

test('maps everything else to en-US', () => {
  assert.equal(appLocale('en'), 'en-US')
  assert.equal(appLocale('en-US'), 'en-US')
  assert.equal(appLocale(undefined), 'en-US')
  assert.equal(appLocale(null), 'en-US')
  assert.equal(appLocale(''), 'en-US')
})
