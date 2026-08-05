import test from 'node:test'
import assert from 'node:assert/strict'
import { toDateInputHub } from '../src/utils/timezone.js'

test('formats date inputs in the hub timezone instead of UTC', () => {
  assert.equal(toDateInputHub(new Date('2026-08-04T17:30:00.000Z')), '2026-08-05')
  assert.equal(toDateInputHub(new Date('2026-08-05T00:30:00.000Z')), '2026-08-05')
})
