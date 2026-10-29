import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_COMMIT, APP_VERSION, appVersionLabel } from '../src/utils/appVersion.js'

test('outside a Vite build the version falls back to placeholders', () => {
  assert.equal(APP_VERSION, '0.0.0')
  assert.equal(APP_COMMIT, 'dev')
})

test('the label joins version and commit', () => {
  assert.equal(appVersionLabel('1.0.0', '38164ca'), 'v1.0.0 (38164ca)')
})
