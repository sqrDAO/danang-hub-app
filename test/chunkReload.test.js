import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldReloadForStaleChunk, STALE_CHUNK_RELOAD_WINDOW_MS } from '../src/utils/chunkReload.js'

const now = 1_700_000_000_000

test('reloads when there was no earlier reload', () => {
  assert.equal(shouldReloadForStaleChunk(null, now), true)
  assert.equal(shouldReloadForStaleChunk(Number.NaN, now), true)
})

test('does not reload again inside the window', () => {
  assert.equal(shouldReloadForStaleChunk(now, now), false)
  assert.equal(shouldReloadForStaleChunk(now - STALE_CHUNK_RELOAD_WINDOW_MS, now), false)
})

test('reloads again once the window has passed', () => {
  assert.equal(shouldReloadForStaleChunk(now - STALE_CHUNK_RELOAD_WINDOW_MS - 1, now), true)
})
