import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { groupTokenEntries, decideMemberMarkers } = require('../functions/pushTokens.js')

test('groupTokenEntries keeps one item per phone token', () => {
  const grouped = groupTokenEntries([
    { token: 'a', ref: 'devices/phone-1' },
    { token: 'b', ref: 'devices/phone-2' }
  ])
  assert.deepEqual(grouped, [
    { token: 'a', refs: ['devices/phone-1'] },
    { token: 'b', refs: ['devices/phone-2'] }
  ])
})

test('groupTokenEntries sends a token stored twice once, keeping both docs for cleanup', () => {
  const grouped = groupTokenEntries([
    { token: 'a', ref: 'push_tokens/member-a' },
    { token: 'a', ref: 'devices/phone-1' }
  ])
  assert.deepEqual(grouped, [
    { token: 'a', refs: ['push_tokens/member-a', 'devices/phone-1'] }
  ])
})

test('groupTokenEntries skips empty and non-string tokens', () => {
  assert.deepEqual(groupTokenEntries([
    { token: '', ref: 'x' },
    { token: undefined, ref: 'y' }
  ]), [])
})

test('decideMemberMarkers marks a member when any phone succeeded', () => {
  const result = decideMemberMarkers([
    { memberId: 'm1', success: false },
    { memberId: 'm1', success: true },
    { memberId: 'm1', success: false }
  ])
  assert.deepEqual(result, { marked: ['m1'], released: [] })
})

test('decideMemberMarkers releases a member only when every phone failed', () => {
  const result = decideMemberMarkers([
    { memberId: 'm1', success: false },
    { memberId: 'm2', success: true },
    { memberId: 'm1', success: false }
  ])
  assert.deepEqual(result, { marked: ['m2'], released: ['m1'] })
})
