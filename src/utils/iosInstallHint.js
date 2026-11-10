// iPhone only allows web push from a Home Screen web app (iOS 16.4+). In a
// browser tab Notification is missing, so push can't be offered there; the
// member has to install the app first. In-app browsers (Zalo, Facebook,
// Messenger, Instagram, LINE, Telegram, WeChat) have no Add to Home Screen, so
// they get "open this page in Safari" instead of the steps.
import { isMobilePushEligible } from './mobilePushEligibility.js'

// iPhone and iPod send "iPhone OS 18_6"; iPad sends "CPU OS", so it never matches.
const IPHONE_OS_VERSION = /iPhone OS (\d+)_(\d+)/
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|Line\/|Zalo|Telegram|MicroMessenger/

const isIosAtLeast164 = (userAgent) => {
  const match = userAgent.match(IPHONE_OS_VERSION)
  if (!match) return false
  const major = Number(match[1])
  return major > 16 || (major === 16 && Number(match[2]) >= 4)
}

/**
 * Pure: which install hint an iPhone without push should get.
 * @param {{userAgent?: string, standalone?: boolean, phone?: boolean}} input
 *   phone is the shared push-eligible-phone check, so device rules live in one place.
 * @returns {'install'|'safari'|null}
 */
export const resolveHomeScreenInstallHint = ({ userAgent = '', standalone = false, phone = false } = {}) => {
  if (!phone || standalone || !isIosAtLeast164(userAgent)) return null
  return IN_APP_BROWSER.test(userAgent) ? 'safari' : 'install'
}

export const getHomeScreenInstallHint = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null
  return resolveHomeScreenInstallHint({
    userAgent: navigator.userAgent || '',
    standalone: navigator.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches === true,
    phone: isMobilePushEligible()
  })
}
