import test from 'node:test'
import assert from 'node:assert/strict'
import { toSafeRedirectPath } from '../src/utils/safeRedirect.js'

test('keeps in-app paths', () => {
  assert.equal(toSafeRedirectPath('/member/bookings'), '/member/bookings')
  assert.equal(toSafeRedirectPath('/member/events'), '/member/events')
  assert.equal(toSafeRedirectPath('/'), '/')
})

test('rejects protocol-relative and backslash paths', () => {
  assert.equal(toSafeRedirectPath('//evil.example'), null)
  assert.equal(toSafeRedirectPath('/\\evil.example'), null)
  assert.equal(toSafeRedirectPath('\\\\evil.example'), null)
  assert.equal(toSafeRedirectPath('/member//evil'), null)
})

test('rejects absolute URLs and schemes', () => {
  assert.equal(toSafeRedirectPath('https://evil.example'), null)
  assert.equal(toSafeRedirectPath('javascript:alert(1)'), null)
  assert.equal(toSafeRedirectPath('evil.example'), null)
})

test('rejects whitespace and control characters browsers strip', () => {
  assert.equal(toSafeRedirectPath('/\t/evil.example'), null)
  assert.equal(toSafeRedirectPath('/\n/evil.example'), null)
  assert.equal(toSafeRedirectPath(' /member'), null)
  assert.equal(toSafeRedirectPath('/\u0000/evil.example'), null)
})

test('rejects missing and non-string values', () => {
  assert.equal(toSafeRedirectPath(null), null)
  assert.equal(toSafeRedirectPath(undefined), null)
  assert.equal(toSafeRedirectPath(''), null)
  assert.equal(toSafeRedirectPath(42), null)
})
