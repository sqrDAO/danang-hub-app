import test from 'node:test'
import assert from 'node:assert/strict'
import { appVersionLabel } from '../src/utils/appVersion.js'

test('the label joins version and commit', () => {
  assert.equal(appVersionLabel('1.0.0', '38164ca'), 'v1.0.0 (38164ca)')
})
