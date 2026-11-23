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
  const ids = (from) => getUpcomingHubClosures(from).map(c => c.id)
  assert.ok(ids('2026-09-02').includes('independence-day-2026'))
  assert.ok(!ids('2026-09-03').includes('independence-day-2026'))
  assert.ok(ids('2026-11-24').includes('culture-day-2026'))
  assert.ok(!ids('2026-11-25').includes('culture-day-2026'))
  assert.equal(getUpcomingHubClosures('2029-01-01').length, 0)
})

test('withinDays keeps only closures starting inside the window', () => {
  const ids = (from, withinDays) => getUpcomingHubClosures(from, { withinDays }).map(c => c.id)
  assert.deepEqual(ids('2026-11-25', 30), [])
  assert.deepEqual(ids('2026-11-25', 45), ['new-year-2027'])
  assert.deepEqual(ids('2026-11-17', 45), ['culture-day-2026', 'new-year-2027'])
  assert.deepEqual(ids('2026-12-21', 45), ['new-year-2027', 'lunar-new-year-2027'])
  // An ongoing closure stays listed until its last day.
  assert.deepEqual(ids('2027-02-08', 0), ['lunar-new-year-2027'])
})

test('every declared closure is well-formed, unique and labelled in both locales', () => {
  const require = createRequire(import.meta.url)
  const en = require('../src/locales/en.json')
  const vi = require('../src/locales/vi.json')
  const seen = new Set()
  for (const closure of HUB_CLOSURES) {
    assert.ok(!seen.has(closure.id), `duplicate id ${closure.id}`)
    seen.add(closure.id)
    assert.match(closure.start, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(closure.end, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(closure.start <= closure.end, `${closure.id} ends before it starts`)
    const key = closure.labelKey.replace(/^closures\./, '')
    assert.equal(typeof en.closures[key], 'string', `${closure.id}: missing EN label`)
    assert.equal(typeof vi.closures[key], 'string', `${closure.id}: missing VI label`)
  }
})

test('2027 holidays close the Hub, and the days around them stay open', () => {
  const closed = ['2027-01-01', '2027-02-04', '2027-02-10', '2027-04-16', '2027-04-30', '2027-05-01',
    '2027-05-03', '2027-07-27', '2027-09-02', '2027-09-03', '2027-11-24']
  const open = ['2027-01-04', '2027-02-03', '2027-02-11', '2027-05-04', '2027-09-06', '2027-11-25']
  for (const day of closed) assert.equal(isHubClosed(day), true, `${day} should be closed`)
  for (const day of open) assert.equal(isHubClosed(day), false, `${day} should be open`)
  assert.equal(getHubClosure('2027-02-06').labelKey, 'closures.lunarNewYear')
})

test('2028 declares only the dates fixed by law', () => {
  for (const day of ['2028-01-01', '2028-01-03', '2028-04-04', '2028-04-30', '2028-05-02', '2028-07-27', '2028-11-24']) {
    assert.equal(isHubClosed(day), true, `${day} should be closed`)
  }
  // Tet and National Day 2028 wait for the official schedule.
  assert.equal(isHubClosed('2028-01-26'), false)
  assert.equal(isHubClosed('2028-09-02'), false)
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
