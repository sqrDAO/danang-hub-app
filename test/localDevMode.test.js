import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveLocalDevMode } from '../src/utils/localDevMode.js'

test('skip-auth is on only in DEV with the skip flag', () => {
  assert.equal(resolveLocalDevMode({ isDev: true, skipAuthFlag: 'true' }), true)
})

test('skip-auth stays off in DEV without the flag', () => {
  assert.equal(resolveLocalDevMode({ isDev: true, skipAuthFlag: undefined }), false)
  assert.equal(resolveLocalDevMode({ isDev: true, skipAuthFlag: 'false' }), false)
})

test('skip-auth stays off in production even if the flag is set', () => {
  assert.equal(resolveLocalDevMode({ isDev: false, skipAuthFlag: 'true' }), false)
})
