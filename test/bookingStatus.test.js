import test from 'node:test'
import assert from 'node:assert/strict'
import status from '../functions/bookingStatus.js'
import { makeStore } from './helpers/mcpStore.js'

test('a delayed desk approval or hours-limit decision preserves a member cancellation', async () => {
  const { db, data } = makeStore({ 'bookings/desk': { status: 'pending' } })
  const booking = db.collection('bookings').doc('desk')
  const cancelled = { status: 'cancelled', updatedAt: 'member-cancellation' }
  await db.runTransaction(async tx => tx.update(booking, cancelled))

  for (const decision of [{ status: 'approved' }, { status: 'cancelled', cancelledReason: 'monthly-hours-limit' }]) {
    await status.updatePendingBooking(db, booking, decision)
    assert.deepEqual(data.get('bookings/desk'), cancelled)
  }
})

test('a pending desk booking can still be auto-approved', async () => {
  const { db, data } = makeStore({ 'bookings/desk': { status: 'pending' } })
  await status.updatePendingBooking(db, db.collection('bookings').doc('desk'), { status: 'approved' })
  assert.equal(data.get('bookings/desk').status, 'approved')
})
