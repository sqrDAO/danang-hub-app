import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  canRenewPlan,
  holdsSeat,
  isPendingRenewal,
  recentlyEndedPlans,
  renewalStartDate,
  renewalStateFor
} from '../src/utils/renewals.js'
import { summarizePlan } from '../src/utils/deskPlans.js'

const require = createRequire(import.meta.url)
const server = require('../functions/renewals.js')
const { getCancellationNotice } = require('../functions/bookingNotifications.js')

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// 09:00 / 18:00 hub time (UTC+7) on a hub date.
const at9 = (date) => new Date(`${date}T09:00:00+07:00`)
const at18 = (date) => new Date(`${date}T18:00:00+07:00`)
const day = (date, extra = {}) => ({
  id: `d-${date}`,
  memberId: 'm1',
  amenityId: 'desk-1',
  planType: 'fixed-desk',
  planPeriod: 'weekly',
  planGroupId: 'plan-a',
  status: 'approved',
  startTime: at9(date),
  endTime: at18(date),
  ...extra
})
// Weekly plan Mon 2030-01-07 – Fri 2030-01-11.
const plan = { planGroupId: 'plan-a', planType: 'fixed-desk', planPeriod: 'weekly', status: 'approved', amenityId: 'desk-1', endDate: at18('2030-01-11') }

test('a pending renewal day holds no seat; every other active day does', () => {
  for (const check of [holdsSeat, server.holdsSeat]) {
    assert.equal(check({ status: 'pending', renewalOf: 'plan-a' }), false)
    assert.equal(check({ status: 'approved', renewalOf: 'plan-a' }), true)
    assert.equal(check({ status: 'pending' }), true)
    assert.equal(check({ status: 'cancelled' }), false)
  }
  assert.equal(isPendingRenewal({ status: 'pending', renewalOf: '' }), false)
})

test('renew is offered from 7 days before the last day until 7 days after', () => {
  assert.equal(canRenewPlan(plan, null, new Date(at18('2030-01-11') - 8 * DAY)), false)
  assert.equal(canRenewPlan(plan, null, new Date(at18('2030-01-11') - 7 * DAY)), true)
  assert.equal(canRenewPlan(plan, null, new Date(at18('2030-01-11').getTime() + 7 * DAY)), true)
  assert.equal(canRenewPlan(plan, null, new Date(at18('2030-01-11').getTime() + 8 * DAY)), false)
})

test('renew is not offered once renewed, for a pending plan, or for partner desks', () => {
  const now = at9('2030-01-10')
  assert.equal(canRenewPlan(plan, 'pending', now), false)
  assert.equal(canRenewPlan({ ...plan, status: 'pending' }, null, now), false)
  assert.equal(canRenewPlan({ ...plan, planType: 'partner-desk' }, null, now), false)
})

test('a renewal starts the first working day after the plan', () => {
  assert.equal(renewalStartDate(plan, at9('2030-01-09')), '2030-01-14')
})

test('a lapsed renewal starts the next working day from today', () => {
  // Wednesday 2030-01-16, plan ended the Friday before.
  assert.equal(renewalStartDate(plan, at9('2030-01-16')), '2030-01-17')
  // Friday: tomorrow is Saturday, so Monday.
  assert.equal(renewalStartDate(plan, at9('2030-01-18')), '2030-01-21')
})

test('renewal state follows the renewal days', () => {
  const bookings = [day('2030-01-14', { planGroupId: 'plan-b', renewalOf: 'plan-a', status: 'pending' })]
  assert.equal(renewalStateFor('plan-a', bookings), 'pending')
  assert.equal(renewalStateFor('plan-a', [{ ...bookings[0], status: 'approved' }]), 'approved')
  assert.equal(renewalStateFor('plan-a', [{ ...bookings[0], status: 'cancelled' }]), null)
})

test('keeps a plan listed for 7 days after it ends, and on its last day', () => {
  const week = ['2030-01-07', '2030-01-08', '2030-01-09', '2030-01-10', '2030-01-11'].map(d => day(d))
  const lastDay = recentlyEndedPlans(week, new Date(at9('2030-01-11').getTime() + HOUR))
  assert.equal(lastDay.length, 1)
  assert.equal(lastDay[0].ended, false)
  // The day under way still counts, so the card does not read "0 days".
  assert.equal(lastDay[0].count, 1)
  const after = recentlyEndedPlans(week, at9('2030-01-15'))
  assert.equal(after[0].ended, true)
  assert.equal(recentlyEndedPlans(week, at9('2030-01-19')).length, 0)
  // Days still to come: listed by the regular plan list instead.
  assert.equal(recentlyEndedPlans(week, at9('2030-01-09')).length, 0)
})

test('reminds 3 days before an approved plan ends, once renewed never', () => {
  const today = at9('2030-01-08').getTime() - 9 * HOUR
  const bookings = ['2030-01-08', '2030-01-09', '2030-01-10', '2030-01-11'].map(d => day(d))
  const ending = server.plansEndingSoon(bookings, today, today + 10 * HOUR)
  assert.deepEqual(ending.map(p => p.planGroupId), ['plan-a'])
  const renewed = [...bookings, day('2030-01-14', { planGroupId: 'plan-b', renewalOf: 'plan-a', status: 'pending' })]
  assert.deepEqual(server.plansEndingSoon(renewed, today, today + 10 * HOUR).map(p => p.planGroupId), [])
})

test('does not remind too early, or for a plan still pending', () => {
  const today = at9('2030-01-07').getTime() - 9 * HOUR
  const bookings = ['2030-01-07', '2030-01-11'].map(d => day(d))
  assert.equal(server.plansEndingSoon(bookings, today, today).length, 0)
  const pending = bookings.map(b => ({ ...b, status: 'pending' }))
  assert.equal(server.plansEndingSoon(pending, today + 2 * DAY, today + 2 * DAY).length, 0)
})

test('a rejected renewal tells the member why', () => {
  const notice = getCancellationNotice(
    { status: 'pending' },
    { status: 'cancelled', cancelledReason: 'renewal-rejected', rejectionReason: '  Desk reserved  ', planType: 'fixed-desk' }
  )
  assert.equal(notice.isRenewalRejection, true)
  assert.equal(notice.rejectionReason, 'Desk reserved')
})

test('a renewal naming someone else\'s plan does not silence their reminder', () => {
  const today = at9('2030-01-08').getTime() - 9 * HOUR
  const bookings = ['2030-01-08', '2030-01-11'].map(d => day(d))
  const forged = day('2030-01-14', { memberId: 'm2', planGroupId: 'plan-x', renewalOf: 'plan-a', status: 'pending' })
  assert.deepEqual(server.plansEndingSoon([...bookings, forged], today, today + HOUR).map(p => p.planGroupId), ['plan-a'])
})

test('days a renewal loses one by one send no notice', () => {
  for (const reason of ['renewal-expired', 'renewal-day-unavailable']) {
    assert.equal(getCancellationNotice({ status: 'pending' }, { status: 'cancelled', cancelledReason: reason, planType: 'fixed-desk' }), null, reason)
  }
})

test('a plan summary ignores cancelled days', () => {
  const days = [
    day('2030-01-07', { status: 'cancelled' }),
    day('2030-01-08'),
    day('2030-01-09'),
    day('2030-01-10', { status: 'cancelled' })
  ]
  const summary = summarizePlan('plan-a', days, at9('2030-01-06'))
  assert.equal(summary.status, 'approved')
  assert.equal(summary.count, 2)
  assert.equal(new Date(summary.endDate).getTime(), at18('2030-01-09').getTime())
  assert.equal(canRenewPlan(summary, null, at9('2030-01-08')), true)
})

test('a plan summary is pending while any live day is, and cancelled when all are', () => {
  assert.equal(summarizePlan('p', [day('2030-01-07'), day('2030-01-08', { status: 'pending' })]).status, 'pending')
  assert.equal(summarizePlan('p', [day('2030-01-07', { status: 'cancelled' })]).status, 'cancelled')
})
