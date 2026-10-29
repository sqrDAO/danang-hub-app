// Desk plans: one booking per working day sharing a planGroupId. Members
// register Fixed Desk plans themselves; a member attached to a partner org
// (members.partnerId) is instead booked on the org's desk by the hourly
// Partner Desk sync (functions/partnerDesks.js).
export const FIXED_DESK = 'fixed-desk'
export const PARTNER_DESK = 'partner-desk'
export const DESK_PLAN_TYPES = [FIXED_DESK, PARTNER_DESK]

export const isDeskPlan = (planType) => DESK_PLAN_TYPES.includes(planType)

// Partner only while the partner org exists and has a desk — the same test
// the server sync uses. A partner without a desk books nothing, so its
// members keep the Fixed Desk flow.
export const deskPlanTypeFor = (profile, partners = []) => {
  const partner = profile?.partnerId && partners.find(p => p.id === profile.partnerId)
  return partner?.deskAmenityId ? PARTNER_DESK : FIXED_DESK
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
