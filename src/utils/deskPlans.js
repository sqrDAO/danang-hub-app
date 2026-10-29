// Desk plans: one booking per working day sharing a planGroupId. A member
// attached to a partner org (members.partnerId) gets Partner Desk plans,
// everyone else Fixed Desk plans.
export const FIXED_DESK = 'fixed-desk'
export const PARTNER_DESK = 'partner-desk'
export const DESK_PLAN_TYPES = [FIXED_DESK, PARTNER_DESK]

export const isDeskPlan = (planType) => DESK_PLAN_TYPES.includes(planType)

// Partner only while the partner org still exists — the server
// (autoApproveDeskBooking) applies the same test before auto-approving.
export const deskPlanTypeFor = (profile, partners = []) =>
  profile?.partnerId && partners.some(p => p.id === profile.partnerId) ? PARTNER_DESK : FIXED_DESK

// "9AM Games", "9am-games" and "9AMGames" compare equal. Mirrors
// normalizePartnerName in functions/partners.js.
export const normalizePartnerName = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

// i18n namespace for a plan type's copy: `fixedDesk.*` or `partnerDesk.*`
// (also the prefix of its toast keys, e.g. `toast.partnerDeskCreated`).
export const deskPlanCopyPrefix = (planType) => (planType === PARTNER_DESK ? 'partnerDesk' : 'fixedDesk')

export const deskPlanBadgeKey = (planType) => `${deskPlanCopyPrefix(planType)}.badge`
