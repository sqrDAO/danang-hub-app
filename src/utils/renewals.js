/**
 * Fixed Desk renewals, on the hub calendar. A renewal is a new fixed-desk plan
 * whose days carry renewalOf: <the planGroupId it renews>. It waits for an
 * admin and, while it waits, holds no seat (mirrors functions/renewals.js).
 * Pure, so `test/renewals.test.js` can run it; extensions are required for
 * Node's ESM test runner.
 */
import { addHubDays, getHubDayOfWeek, toDateInputHub } from './timezone.js'

export const RENEW_WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const ACTIVE_STATUSES = ['pending', 'approved', 'checked-in']

export const isPendingRenewal = (booking) =>
  booking?.status === 'pending' && typeof booking.renewalOf === 'string' && booking.renewalOf.length > 0

export const holdsSeat = (booking) =>
  ACTIVE_STATUSES.includes(booking.status) && !isPendingRenewal(booking)

// 'pending' | 'approved' | null: the state of the renewal made for a plan.
export const renewalStateFor = (planGroupId, bookings) => {
  const days = bookings.filter(b => b.renewalOf === planGroupId && b.status !== 'cancelled')
  if (days.length === 0) return null
  return days.some(b => b.status === 'pending') ? 'pending' : 'approved'
}

// Renew is offered from RENEW_WINDOW_DAYS before a Fixed Desk plan's last day
// until RENEW_WINDOW_DAYS after it, once, never for a renewal that is itself
// still waiting for an admin, and never for a plan that was ended early.
// `plan` is a summarizePlan result (src/utils/deskPlans.js).
export const canRenewPlan = (plan, renewalState, now = new Date()) => {
  if (plan.planType !== 'fixed-desk' || renewalState) return false
  if (plan.status === 'pending' || plan.status === 'cancelled' || plan.cutShort) return false
  const endMs = new Date(plan.endDate).getTime()
  const nowMs = now.getTime()
  return nowMs >= endMs - RENEW_WINDOW_DAYS * DAY_MS && nowMs <= endMs + RENEW_WINDOW_DAYS * DAY_MS
}

// "YYYY-MM-DD" the renewal starts: the first working day after the plan's last
// day, or after today when the plan has already lapsed.
export const renewalStartDate = (plan, now = new Date()) => {
  const dayAfterPlan = addHubDays(new Date(plan.endDate), 1)
  const tomorrow = addHubDays(now, 1)
  let start = dayAfterPlan > tomorrow ? dayAfterPlan : tomorrow
  while ([0, 6].includes(getHubDayOfWeek(start))) start = addHubDays(start, 1)
  return toDateInputHub(start)
}
