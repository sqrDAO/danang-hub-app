const MOBILE_PHONE_USER_AGENT = /android.+mobile|iphone|ipod|windows phone/i
const MOBILE_OR_TABLET_USER_AGENT = /android|iphone|ipod|ipad|windows phone/i

export const isMobilePhoneUserAgent = (userAgent = '') =>
  MOBILE_PHONE_USER_AGENT.test(userAgent)

export const isMobileOrTabletUserAgent = (userAgent = '') =>
  MOBILE_OR_TABLET_USER_AGENT.test(userAgent)

// iPadOS can identify itself as macOS. Touch points distinguish that case from
// a regular desktop Safari session without relying on viewport width.
export const isMobileOrTabletDevice = (navigatorLike) => {
  if (!navigatorLike) return false
  if (navigatorLike.userAgentData?.mobile === true) return true

  const userAgent = navigatorLike.userAgent || ''
  return isMobileOrTabletUserAgent(userAgent) || (
    /macintosh/i.test(userAgent) && (navigatorLike.maxTouchPoints || 0) > 1
  )
}

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
