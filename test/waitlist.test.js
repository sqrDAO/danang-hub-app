import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { getNewlyPromoted } = require('../functions/waitlist.js')

test('getNewlyPromoted returns a uid moved from waitlist to attendees in one write', () => {
  const before = { attendees: ['a'], waitlist: ['b', 'c'] }
  const after = { attendees: ['a', 'b'], waitlist: ['c'] }
  assert.deepEqual(getNewlyPromoted(before, after), ['b'])
})

test('getNewlyPromoted ignores an attendees-only add of a uid still on the waitlist', () => {
  // The spoof: a member writes another member's uid into attendees but leaves
  // it in waitlist. That must not look like a promotion.
  const before = { attendees: ['a'], waitlist: ['b'] }
  const after = { attendees: ['a', 'b'], waitlist: ['b'] }
  assert.deepEqual(getNewlyPromoted(before, after), [])
})

test('getNewlyPromoted ignores a uid that joined attendees without being waitlisted', () => {
  const before = { attendees: ['a'], waitlist: ['b'] }
  const after = { attendees: ['a', 'd'], waitlist: ['b'] }
  assert.deepEqual(getNewlyPromoted(before, after), [])
})

test('getNewlyPromoted tolerates missing attendees and waitlist arrays', () => {
  assert.deepEqual(getNewlyPromoted({}, {}), [])
  assert.deepEqual(getNewlyPromoted({ waitlist: ['b'] }, { attendees: ['b'] }), ['b'])
})
