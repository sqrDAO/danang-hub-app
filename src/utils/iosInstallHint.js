// iPhone only allows web push from a Home Screen web app (iOS 16.4+). In a
// browser tab Notification is missing, so push can't be offered there; the
// member has to install the app first.

const IPHONE_USER_AGENT = /iphone|ipod/i
const IOS_VERSION = /OS (\d+)_(\d+)/

const isIosAtLeast164 = (userAgent) => {
  const match = userAgent.match(IOS_VERSION)
  if (!match) return false
  const major = Number(match[1])
  return major > 16 || (major === 16 && Number(match[2]) >= 4)
}

export const resolveNeedsHomeScreenInstall = ({ userAgent = '', standalone = false } = {}) =>
  !standalone && IPHONE_USER_AGENT.test(userAgent) && isIosAtLeast164(userAgent)

export const needsHomeScreenInstall = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return resolveNeedsHomeScreenInstall({
    userAgent: navigator.userAgent || '',
    standalone: navigator.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches === true
  })
}
