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
  assert.equal(getUpcomingHubClosures('2026-08-01').length, 2)
  assert.equal(getUpcomingHubClosures('2026-09-02').length, 2)
  assert.equal(getUpcomingHubClosures('2026-09-03').length, 1)
  assert.equal(getUpcomingHubClosures('2026-11-24').length, 1)
  assert.equal(getUpcomingHubClosures('2026-11-25').length, 0)
})

test('closes the Hub for the whole of 24 Nov 2026 (Vietnamese Culture Day)', () => {
  assert.equal(getHubClosure('2026-11-24').labelKey, 'closures.cultureDay2026')
  assert.equal(isHubClosed('2026-11-23'), false)
  assert.equal(isHubClosed('2026-11-25'), false)
  // Hub day boundaries are +07:00.
  assert.equal(isHubClosed(new Date('2026-11-23T17:00:00.000Z')), true)
  assert.equal(isHubClosed(new Date('2026-11-24T16:59:59.000Z')), true)
  assert.equal(isHubClosed(new Date('2026-11-24T17:00:00.000Z')), false)
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
    // The server interpolates `label` into user-facing errors while the client
    // carries `labelKey`. A client entry copy-pasted into the mirror would
    // otherwise pass every check above and render "(undefined)" to an admin.
    assert.equal(typeof mirrored.label, 'string', `${closure.id} is missing its server label`)
    assert.ok(mirrored.label.length > 0, `${closure.id} has an empty server label`)
    assert.equal(typeof closure.labelKey, 'string', `${closure.id} is missing its client labelKey`)
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
