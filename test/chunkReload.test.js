import test from 'node:test'
import assert from 'node:assert/strict'
import { isOptionalChunkError, shouldReloadForStaleChunk } from '../src/utils/chunkReload.js'

const pageError = new TypeError(
  'Failed to fetch dynamically imported module: https://hub.example/assets/Events-AbC123.js'
)
const heroError = new TypeError(
  'Failed to fetch dynamically imported module: https://hub.example/assets/HeroCanvas3D-CmhyWNjJ.js'
)
const base = { error: pageError, online: true, reloadedBuild: null, currentBuild: 'abc1234@2026-11-03T00:00:00.000Z' }

test('reloads when this build has not reloaded yet', () => {
  assert.equal(shouldReloadForStaleChunk(base), true)
})

test('reloads when online is unknown', () => {
  assert.equal(shouldReloadForStaleChunk({ ...base, online: undefined }), true)
})

test('does not reload twice for the same build', () => {
  assert.equal(shouldReloadForStaleChunk({ ...base, reloadedBuild: base.currentBuild }), false)
})

test('reloads again after a later deploy', () => {
  assert.equal(
    shouldReloadForStaleChunk({ ...base, reloadedBuild: 'abc1234@2026-11-02T00:00:00.000Z' }),
    true
  )
})

test('does not reload while offline', () => {
  assert.equal(shouldReloadForStaleChunk({ ...base, online: false }), false)
})

test('does not reload for the optional HeroCanvas3D chunk', () => {
  assert.equal(shouldReloadForStaleChunk({ ...base, error: heroError }), false)
})

test('isOptionalChunkError matches only HeroCanvas3D', () => {
  assert.equal(isOptionalChunkError(heroError), true)
  assert.equal(
    isOptionalChunkError(new Error('error loading dynamically imported module: /assets/HeroCanvas3D-x.js')),
    true
  )
  assert.equal(isOptionalChunkError(pageError), false)
  assert.equal(isOptionalChunkError(new TypeError('Importing a module script failed.')), false)
  assert.equal(isOptionalChunkError(undefined), false)
  assert.equal(isOptionalChunkError('HeroCanvas3D'), true)
})
