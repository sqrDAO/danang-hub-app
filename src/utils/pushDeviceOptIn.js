// Which *device* opted into push, kept separate from the account-level
// `preferences.pushNotifications` mirror on the member doc.
//
// The launch-time token refresh cannot key off browser permission alone:
// disablePushNotifications deletes the token but leaves Notification.permission
// granted, so a permission-only gate would resurrect push for someone who
// deliberately turned it off. It cannot key off the member preference either —
// that is the field the server clears on a stale token, which is exactly the
// state the refresh exists to heal. Hence a third, device-local signal.

const DEVICE_OPT_IN_KEY = (uid) => `pushDeviceOptIn:${uid}`

/**
 * Pure launch-refresh decision, split out so the matrix is testable without a
 * browser. All three inputs must hold: the device can register at all, the user
 * granted permission, and this device is the one that opted in.
 * @param {{eligible: boolean, permission: string, deviceOptedIn: boolean}} input
 * @returns {boolean}
 */
export const shouldRefreshPushToken = ({
  eligible = false,
  permission = 'default',
  deviceOptedIn = false
} = {}) => Boolean(eligible) && permission === 'granted' && Boolean(deviceOptedIn)

export const isDeviceOptedIn = (uid) => {
  if (!uid || typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DEVICE_OPT_IN_KEY(uid)) === 'true'
  } catch {
    // Storage blocked (private mode / third-party restrictions). Treat as not
    // opted in: skipping a refresh is recoverable, resurrecting an opt-out is not.
    return false
  }
}

export const setDeviceOptedIn = (uid) => {
  if (!uid || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEVICE_OPT_IN_KEY(uid), 'true')
  } catch {
    // Ignore write failures; push still works for this session.
  }
}

export const clearDeviceOptedIn = (uid) => {
  if (!uid || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(DEVICE_OPT_IN_KEY(uid))
  } catch {
    // Ignore removal failures; the permission and token checks still gate refresh.
  }
}
