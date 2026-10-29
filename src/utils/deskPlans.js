// Desk plans: one booking per working day sharing a planGroupId. Members
// register Fixed Desk plans themselves; a member attached to a partner org
// (members.partnerId) is instead booked on the org's desk by the hourly
// Partner Desk sync (functions/partnerDesks.js).
export const FIXED_DESK = 'fixed-desk'
export const PARTNER_DESK = 'partner-desk'
export const DESK_PLAN_TYPES = [FIXED_DESK, PARTNER_DESK]

export const isDeskPlan = (planType) => DESK_PLAN_TYPES.includes(planType)

// Partner only while the partner org exists and its desk is a bookable desk —
// the test the server sync applies before booking anything. Otherwise the
// member gets nothing automatic, so they keep the Fixed Desk flow.
export const deskPlanTypeFor = (profile, partners = [], amenities = []) => {
  const partner = profile?.partnerId && partners.find(p => p.id === profile.partnerId)
  const desk = partner?.deskAmenityId && amenities.find(a => a.id === partner.deskAmenityId)
  return desk?.type === 'desk' && desk.isAvailable !== false ? PARTNER_DESK : FIXED_DESK
}

// A plan the hourly sync owns (planGroupId `partner_<uid>`), as opposed to a
// partner-desk plan registered by hand before the sync existed.
export const isSyncedPartnerPlan = (plan) =>
  plan?.planType === PARTNER_DESK && plan.planGroupId?.startsWith('partner_')

// "9AM Games", "9am-games" and "9AMGames" compare equal. Mirrors
// normalizePartnerName in functions/partners.js.
export const normalizePartnerName = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

// i18n namespace for a plan type's copy: `fixedDesk.*` or `partnerDesk.*`.
export const deskPlanCopyPrefix = (planType) => (planType === PARTNER_DESK ? 'partnerDesk' : 'fixedDesk')

export const deskPlanBadgeKey = (planType) => `${deskPlanCopyPrefix(planType)}.badge`

// One summary of a plan's days, shared by the member plan list, the recently
// ended list and the admin Renewals panel. Cancelled days do not count toward
// its status, dates or day count; a plan with only cancelled days is
// 'cancelled'. Days are approved one by one, so any pending day makes it
// pending. `count` is the days not yet over.
export const summarizePlan = (planGroupId, days, now = new Date()) => {
  const byStart = [...days].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
  const live = byStart.filter(b => b.status !== 'cancelled')
  const counted = live.length > 0 ? live : byStart
  const first = counted[0]
  const last = counted[counted.length - 1]
  const nowMs = now.getTime()
  const lastLiveMs = live.length > 0 ? new Date(last.startTime).getTime() : -Infinity
  const statusOf = () => {
    if (live.length === 0) return 'cancelled'
    return live.some(b => b.status === 'pending') ? 'pending' : first.status
  }
  return {
    planGroupId,
    memberId: first.memberId,
    amenityId: first.amenityId,
    planType: first.planType,
    planPeriod: first.planPeriod,
    renewalOf: byStart.find(b => b.renewalOf)?.renewalOf || null,
    startDate: first.startTime,
    endDate: last.endTime,
    status: statusOf(),
    count: live.filter(b => new Date(b.endTime).getTime() > nowMs).length,
    ended: new Date(last.endTime).getTime() <= nowMs,
    // Days cancelled after the last live one: the plan was ended early (by
    // the member or an admin), not run to its end. Hub closures do not count.
    cutShort: byStart.some(b => b.status === 'cancelled' &&
      !String(b.cancelledReason || '').startsWith('hub-closure') &&
      new Date(b.startTime).getTime() > lastLiveMs),
  }
}

const PLAN_LISTED_AFTER_END_MS = 7 * 24 * 60 * 60 * 1000

const groupPlanDays = (bookings) => {
  const groups = new Map()
  bookings
    .filter(b => isDeskPlan(b.planType) && b.planGroupId)
    .forEach(b => groups.set(b.planGroupId, [...(groups.get(b.planGroupId) || []), b]))
  return groups
}

// Whether a plan belongs in the member's plan list. A Partner Desk ends by
// cancellation (detach, skipped days), so it shows only while it has days
// left. A Fixed Desk plan shows until 7 days after its end, so a member who
// missed the end can still renew it (src/utils/renewals.js).
const isListedPlan = (plan, nowMs) => {
  if (plan.planType === PARTNER_DESK) return plan.count > 0
  return new Date(plan.endDate).getTime() > nowMs - PLAN_LISTED_AFTER_END_MS
}

// The member's desk plans: all of a plan's days grouped once, then filtered
// per plan, so each plan appears exactly once.
export const buildDeskPlans = (bookings, now = new Date()) =>
  [...groupPlanDays(bookings).entries()]
    .map(([id, days]) => summarizePlan(id, days, now))
    .filter(plan => isListedPlan(plan, now.getTime()))
