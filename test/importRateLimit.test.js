import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { nextRateLimitState } = createRequire(import.meta.url)('../functions/importRateLimit.js')

test('ten attempts share a window and the eleventh is rejected', () => {
  let state
  for (let i = 1; i <= 10; i++) state = nextRateLimitState(state, 1000)
  assert.deepEqual(state, { windowStart: 1000, count: 10 })
  assert.equal(nextRateLimitState(state, 3600999), null)
  assert.deepEqual(nextRateLimitState(state, 3601000), { windowStart: 3601000, count: 1 })
})
