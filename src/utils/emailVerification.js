// Event emails go only to a verified Auth email (getVerifiedEmail in
// functions/index.js); verifying is optional. members.email just mirrors it.
// 'verified': Google, or an account that clicked its link.
// 'unverified': a password account that hasn't yet.
// 'none': a wallet (custom token) account, which has no Auth email and types
// its own contact address instead.
export const getEmailStatus = (user) => {
  if (!user?.email) return 'none'
  return user.emailVerified ? 'verified' : 'unverified'
}

const VERIFY_COOLDOWN_MS = 60 * 1000
const sentAtKey = (uid) => `hub-verify-sent:${uid}`

// Whole seconds until another verification email may be sent; 0 when it may.
export const verifyCooldownSecondsLeft = (sentAt, now) =>
  sentAt ? Math.max(0, Math.ceil((sentAt + VERIFY_COOLDOWN_MS - now) / 1000)) : 0

// The resend countdown as m:ss, e.g. 45 → "0:45", 60 → "1:00".
export const formatCooldown = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export const verifyErrorKey = (error) =>
  error?.code === 'auth/too-many-requests' ? 'profile.verifyEmailTooMany' : 'profile.verifyEmailFailed'

// Per tab and per account, so leaving the verify screen can't reset the
// cooldown. Storage can throw (private mode); the cooldown is best effort.
export const readVerifySentAt = (uid) => {
  try {
    return Number(window.sessionStorage.getItem(sentAtKey(uid))) || 0
  } catch {
    return 0
  }
}

export const recordVerifySent = (uid, at = Date.now()) => {
  try {
    window.sessionStorage.setItem(sentAtKey(uid), String(at))
  } catch {
    // Best effort: without storage the button only waits while it stays mounted.
  }
}
