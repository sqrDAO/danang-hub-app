import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SLOT_UNAVAILABLE_REASON,
  conflictCheckErrorKey,
  isSlotTaken,
  isSlotUnavailableError,
  isTransientConflictError,
  markConflictCheckError,
  retryTransientOnce,
  seriesErrorKey
} from '../src/utils/conflictCheck.js'

const fnError = (code, details) => Object.assign(new Error(code), { code: `functions/${code}`, details })
const slotUnavailable = () => fnError('invalid-argument', { reason: SLOT_UNAVAILABLE_REASON })

test('transient codes are retried, request errors are not', () => {
  for (const code of ['unavailable', 'deadline-exceeded', 'internal', 'unknown', 'aborted']) {
    assert.equal(isTransientConflictError(fnError(code)), true, code)
  }
  for (const code of ['invalid-argument', 'permission-denied', 'unauthenticated', 'not-found', 'failed-precondition']) {
    assert.equal(isTransientConflictError(fnError(code)), false, code)
  }
  assert.equal(isTransientConflictError(new Error('Invalid booking conflict response')), false)
  assert.equal(isTransientConflictError(undefined), false)
})

test('only invalid-argument with the slot-unavailable reason is a day off', () => {
  assert.equal(isSlotUnavailableError(slotUnavailable()), true)
  assert.equal(isSlotUnavailableError(fnError('invalid-argument')), false)
  assert.equal(isSlotUnavailableError(fnError('invalid-argument', { reason: 'other' })), false)
  assert.equal(isSlotUnavailableError(fnError('internal', { reason: SLOT_UNAVAILABLE_REASON })), false)
})

test('retryTransientOnce retries a transient failure exactly once', async () => {
  let calls = 0
  const result = await retryTransientOnce(async () => {
    calls += 1
    if (calls === 1) throw fnError('unavailable')
    return 'ok'
  }, 0)
  assert.equal(result, 'ok')
  assert.equal(calls, 2)

  calls = 0
  await assert.rejects(retryTransientOnce(async () => {
    calls += 1
    throw fnError('deadline-exceeded')
  }, 0), { code: 'functions/deadline-exceeded' })
  assert.equal(calls, 2)
})

test('retryTransientOnce does not retry a non-transient failure', async () => {
  let calls = 0
  await assert.rejects(retryTransientOnce(async () => {
    calls += 1
    throw slotUnavailable()
  }, 0), { code: 'functions/invalid-argument' })
  assert.equal(calls, 1)
})

test('isSlotTaken skips a slot-unavailable day and throws on anything else', async () => {
  assert.equal(await isSlotTaken(async () => ({ hasConflicts: true })), true)
  assert.equal(await isSlotTaken(async () => ({ hasConflicts: false })), false)
  assert.equal(await isSlotTaken(async () => { throw slotUnavailable() }), true)
  await assert.rejects(isSlotTaken(async () => { throw fnError('invalid-argument') }), { code: 'functions/invalid-argument' })
  await assert.rejects(isSlotTaken(async () => { throw fnError('unavailable') }), { code: 'functions/unavailable' })
})

test('isSlotTaken passes its arguments through to the check', async () => {
  const seen = []
  await isSlotTaken(async (...args) => { seen.push(args); return { hasConflicts: false } }, 'desk-1', 'a', 'b', 'id')
  assert.deepEqual(seen, [['desk-1', 'a', 'b', 'id']])
})

test('message keys name a failed check', () => {
  assert.equal(conflictCheckErrorKey(slotUnavailable()), 'toast.slotNoLongerAvailable')
  assert.equal(conflictCheckErrorKey(fnError('invalid-argument')), 'memberBookings.conflictCheckFailed')
  assert.equal(conflictCheckErrorKey(fnError('unavailable')), 'memberBookings.conflictCheckFailed')

  const checkError = markConflictCheckError(fnError('unavailable'))
  assert.equal(checkError.conflictCheckFailed, true)
  assert.equal(seriesErrorKey(checkError, 'toast.fixedDeskFailed'), 'memberBookings.conflictCheckFailed')
  assert.equal(seriesErrorKey(new Error('write failed'), 'toast.fixedDeskFailed'), 'toast.fixedDeskFailed')
  assert.equal(seriesErrorKey(undefined, 'toast.renewalFailed'), 'toast.renewalFailed')
})
