import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { getCancellationNotice } = require('../functions/bookingNotifications.js')

const approved = { status: 'approved' }
const cancelledBy = (reason, extra = {}) => ({ status: 'cancelled', cancelledReason: reason, ...extra })

test('notifies when an active booking is cancelled with a reason', () => {
  const notice = getCancellationNotice(approved, cancelledBy('admin'))
  assert.ok(notice)
  assert.equal(notice.reason, 'admin')
  assert.equal(notice.isHubClosure, false)
  assert.equal(notice.isFixedDesk, false)
})

test('stays silent when the member cancels their own booking', () => {
  // The member-facing path writes status only — no reason, no notification.
  assert.equal(getCancellationNotice(approved, { status: 'cancelled' }), null)
  assert.equal(getCancellationNotice(approved, cancelledBy('   ')), null)
  assert.equal(getCancellationNotice(approved, cancelledBy(42)), null)
})

test('stays silent when the status did not change', () => {
  assert.equal(getCancellationNotice(cancelledBy('admin'), cancelledBy('admin')), null)
})

test('stays silent for statuses that are not an active booking', () => {
  assert.equal(getCancellationNotice({ status: 'completed' }, cancelledBy('admin')), null)
  assert.equal(getCancellationNotice({ status: 'cancelled' }, cancelledBy('admin')), null)
})

test('stays silent for any write that is not a cancellation', () => {
  assert.equal(getCancellationNotice({ status: 'pending' }, { status: 'approved' }), null)
  assert.equal(getCancellationNotice(approved, { status: 'checked-in' }), null)
})

test('flags Hub closure reasons by prefix so future closures need no code change', () => {
  assert.equal(getCancellationNotice(approved, cancelledBy('hub-closure-independence-day-2026')).isHubClosure, true)
  assert.equal(getCancellationNotice(approved, cancelledBy('hub-closure-tet-2027')).isHubClosure, true)
  assert.equal(getCancellationNotice(approved, cancelledBy('admin')).isHubClosure, false)
})

test('flags fixed desk plans so the copy can name the plan', () => {
  const notice = getCancellationNotice(approved, cancelledBy('admin', { planType: 'fixed-desk' }))
  assert.equal(notice.isFixedDesk, true)
})

test('tolerates missing documents', () => {
  assert.equal(getCancellationNotice(null, cancelledBy('admin')), null)
  assert.equal(getCancellationNotice(approved, null), null)
})
