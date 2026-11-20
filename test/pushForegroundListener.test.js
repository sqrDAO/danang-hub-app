import test from 'node:test'
import assert from 'node:assert/strict'
import { createForegroundListener } from '../src/services/pushForegroundListener.js'

const deferred = () => {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

test('stop during support detection does not block a new generation or duplicate listeners', async () => {
  const checks = [deferred(), deferred()]
  let check = 0
  let starts = 0
  let stops = 0
  const listener = createForegroundListener({
    isSupported: () => checks[check++].promise,
    start: () => { starts += 1; return () => { stops += 1 } },
    onStop: () => {}
  })
  const stale = listener.ensure()
  assert.equal(listener.ensure(), stale)
  listener.stop()
  const current = listener.ensure()
  assert.notEqual(current, stale)
  checks[0].resolve(true)
  await stale
  assert.equal(starts, 0)
  // Completing the stale attempt must not clear the current pending promise.
  assert.equal(listener.ensure(), current)
  checks[1].resolve(true)
  await current
  await listener.ensure()
  assert.equal(starts, 1)
  listener.stop()
  assert.equal(stops, 1)
})

test('a late stale check cannot replace or remove the current live listener', async () => {
  const checks = [deferred(), deferred()]
  let check = 0
  let starts = 0
  const listener = createForegroundListener({
    isSupported: () => checks[check++].promise,
    start: () => { starts += 1; return () => {} },
    onStop: () => {}
  })
  const stale = listener.ensure()
  listener.stop()
  const current = listener.ensure()
  checks[1].resolve(true)
  await current
  checks[0].resolve(true)
  await stale
  await listener.ensure()
  assert.equal(starts, 1)
})
