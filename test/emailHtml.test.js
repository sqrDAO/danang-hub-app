import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { escapeHtml } = require('../functions/emailHtml.js')

test('escapeHtml escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml(`& < > " '`), '&amp; &lt; &gt; &quot; &#39;')
})

test('escapeHtml leaves ordinary and Vietnamese text unchanged', () => {
  assert.equal(escapeHtml('Hội thảo Web3 Đà Nẵng'), 'Hội thảo Web3 Đà Nẵng')
})

test('escapeHtml returns an empty string for null and undefined', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
})

test('escapeHtml keeps falsy non-null values like 0', () => {
  assert.equal(escapeHtml(0), '0')
})

test('escapeHtml escapes already-escaped text again (use only at output)', () => {
  assert.equal(escapeHtml('&amp;'), '&amp;amp;')
})
