import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  HUB_CLOSURES,
  getHubClosure,
  isHubClosed,
  rangeOverlapsClosure,
  getUpcomingHubClosures,
} from '../src/utils/hubClosures.js'

const INDEPENDENCE_DAY = '2026-08-31'

test('the Independence Day closure covers 31 Aug through 2 Sep 2026', () => {
  const closure = HUB_CLOSURES.find(c => c.id === 'independence-day-2026')
  assert.ok(closure)
  assert.equal(closure.start, '2026-08-31')
  assert.equal(closure.end, '2026-09-02')
})

test('closes every day of the range, endpoints included', () => {
  for (const day of ['2026-08-31', '2026-09-01', '2026-09-02']) {
    assert.equal(isHubClosed(day), true, `${day} should be closed`)
  }
})

test('leaves the days either side of the closure open', () => {
  assert.equal(isHubClosed('2026-08-30'), false)
  assert.equal(isHubClosed('2026-09-03'), false)
})

test('classifies instants by hub day, not UTC day', () => {
  // 30 Aug 18:00 UTC is already 31 Aug 01:00 in Asia/Ho_Chi_Minh.
  assert.equal(isHubClosed(new Date('2026-08-30T18:00:00.000Z')), true)
  // 2 Sep 17:30 UTC has rolled over to 3 Sep 00:30 hub time.
  assert.equal(isHubClosed(new Date('2026-09-02T17:30:00.000Z')), false)
})

test('returns the closure with its label key for a closed date', () => {
  assert.equal(getHubClosure(INDEPENDENCE_DAY).labelKey, 'closures.independenceDay2026')
  assert.equal(getHubClosure('2026-08-30'), null)
})

test('treats unreadable values as open rather than throwing', () => {
  assert.equal(getHubClosure(null), null)
  assert.equal(getHubClosure(''), null)
  assert.equal(getHubClosure('not-a-date'), null)
  assert.equal(getHubClosure(new Date('nonsense')), null)
})

test('flags a span that only touches the closure at one end', () => {
  assert.ok(rangeOverlapsClosure('2026-08-29', '2026-08-31'))
  assert.ok(rangeOverlapsClosure('2026-09-02', '2026-09-05'))
  assert.ok(rangeOverlapsClosure('2026-08-25', '2026-09-10'))
  assert.equal(rangeOverlapsClosure('2026-09-03', '2026-09-04'), null)
})

test('falls back to the start day when no end is given', () => {
  assert.ok(rangeOverlapsClosure('2026-09-01'))
  assert.equal(rangeOverlapsClosure('2026-09-03'), null)
})

test('lists a closure until its final day has passed', () => {
  assert.equal(getUpcomingHubClosures('2026-08-01').length, 1)
  assert.equal(getUpcomingHubClosures('2026-09-02').length, 1)
  assert.equal(getUpcomingHubClosures('2026-09-03').length, 0)
})

// The closure list is pinned in two places because the client is ESM and the
// functions are CommonJS. Nothing but this test stops the two from drifting.
test('the functions mirror declares the same closure days', () => {
  const require = createRequire(import.meta.url)
  const server = require('../functions/hubClosures.js')

  assert.equal(server.HUB_CLOSURES.length, HUB_CLOSURES.length)
  HUB_CLOSURES.forEach((closure, index) => {
    const mirrored = server.HUB_CLOSURES[index]
    assert.equal(mirrored.id, closure.id)
    assert.equal(mirrored.start, closure.start)
    assert.equal(mirrored.end, closure.end)
  })
})

test('both sides agree on which instants are closed', () => {
  const require = createRequire(import.meta.url)
  const server = require('../functions/hubClosures.js')

  const samples = [
    '2026-08-30T09:00:00+07:00',
    '2026-08-31T09:00:00+07:00',
    '2026-09-01T23:30:00+07:00',
    '2026-09-02T09:00:00+07:00',
    '2026-09-03T09:00:00+07:00',
    '2026-08-30T18:00:00.000Z',
  ]
  for (const sample of samples) {
    assert.equal(
      Boolean(server.getHubClosure(sample)),
      isHubClosed(sample),
      `client and server disagree about ${sample}`
    )
  }
})
