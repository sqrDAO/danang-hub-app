import test from 'node:test'
import assert from 'node:assert/strict'
import { lockViewport, sameBox } from '../src/utils/lockViewport.js'

test('uses the measured box when there is no previous size', () => {
  assert.deepEqual(lockViewport({ w: 0, h: 0 }, { w: 390, h: 700 }), { w: 390, h: 700 })
})

test('ignores a height-only shrink (URL bar shown)', () => {
  assert.deepEqual(
    lockViewport({ w: 390, h: 780 }, { w: 390, h: 700 }),
    { w: 390, h: 780 }
  )
})

test('ignores a height-only grow (URL bar hidden)', () => {
  assert.deepEqual(
    lockViewport({ w: 390, h: 700 }, { w: 390, h: 780 }),
    { w: 390, h: 700 }
  )
})

test('honours a height-only change on a pointer device (window resize)', () => {
  assert.deepEqual(
    lockViewport({ w: 1440, h: 900 }, { w: 1440, h: 1100 }, false),
    { w: 1440, h: 1100 }
  )
})

test('takes the new box as-is on a width change (orientation)', () => {
  assert.deepEqual(
    lockViewport({ w: 390, h: 780 }, { w: 844, h: 390 }),
    { w: 844, h: 390 }
  )
})

test('sameBox is true only when both edges match', () => {
  assert.equal(sameBox({ w: 390, h: 780 }, { w: 390, h: 780 }), true)
  assert.equal(sameBox({ w: 390, h: 780 }, { w: 390, h: 700 }), false)
})
