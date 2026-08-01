const MOBILE_PHONE_USER_AGENT = /android.+mobile|iphone|ipod|windows phone/i

export const isMobilePhoneUserAgent = (userAgent = '') =>
  MOBILE_PHONE_USER_AGENT.test(userAgent)

export const resolveMobilePushEligibility = ({
  windowAvailable,
  navigatorLike
}) => {
  if (!windowAvailable || !navigatorLike) return false
  const phoneUserAgent = isMobilePhoneUserAgent(navigatorLike.userAgent || '')
  if (typeof navigatorLike.userAgentData?.mobile === 'boolean') {
    return navigatorLike.userAgentData.mobile && phoneUserAgent
  }
  return phoneUserAgent
}

export const isMobilePushEligible = () => resolveMobilePushEligibility({
  windowAvailable: typeof window !== 'undefined',
  navigatorLike: typeof navigator !== 'undefined' ? navigator : null
})
