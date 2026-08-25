// Which *device* opted into push, kept separate from the account-level
// `preferences.pushNotifications` mirror on the member doc.
//
// The launch-time token refresh cannot key off browser permission alone:
// disableDevicePushNotifications deletes the token but leaves
// Notification.permission granted, so a permission-only gate would resurrect
// push for someone who deliberately turned it off. It cannot key off the member
// preference either — the account preference is user-intent only and the server
// never clears it. Hence a third, device-local signal.
//
// Three states, not two. An explicit opt-out is *recorded* as 'false' rather
// than removed, so a device that said no stays distinguishable from one that
// was never asked. Only the never-asked state is eligible for the one-time
// adoption below — without that distinction, adopting would silently undo
// every opt-out made before the marker existed.

const DEVICE_OPT_IN_KEY = (uid) => `pushDeviceOptIn:${uid}`
const DEVICE_TOKEN_KEY = (uid) => `pushDeviceToken:${uid}`

export const DEVICE_OPTED_IN = 'in'
export const DEVICE_OPTED_OUT = 'out'
export const DEVICE_OPT_IN_UNKNOWN = 'unknown'

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

/**
 * Whether a device that predates the marker should be adopted as opted in.
 *
 * The marker only starts being written at opt-in time, so every device that
 * opted in before it shipped carries no marker and would never refresh — the
 * members already living with a dead token, which is the whole point of the
 * refresh. Adopt them once, from the two signals that did exist: the account
 * says push is on, and this device granted notification permission. Permission
 * is only ever requested by the Profile toggle and the opt-in banner, so the
 * pair cannot describe a device that never opted in.
 *
 * Restricted to the never-asked state: a recorded opt-out is never adopted.
 * @param {{state: string, preferenceEnabled: boolean, permission: string}} input
 * @returns {boolean}
 */
export const shouldAdoptLegacyOptIn = ({
  state = DEVICE_OPT_IN_UNKNOWN,
  preferenceEnabled = false,
  permission = 'default'
} = {}) => state === DEVICE_OPT_IN_UNKNOWN &&
  Boolean(preferenceEnabled) &&
  permission === 'granted'

export const getDeviceOptInState = (uid) => {
  if (!uid || typeof window === 'undefined') return DEVICE_OPTED_OUT
  try {
    const stored = window.localStorage.getItem(DEVICE_OPT_IN_KEY(uid))
    if (stored === 'true') return DEVICE_OPTED_IN
    if (stored === 'false') return DEVICE_OPTED_OUT
    return DEVICE_OPT_IN_UNKNOWN
  } catch {
    // Storage blocked (private mode / third-party restrictions). Treat as an
    // opt-out rather than as unknown: skipping a refresh is recoverable, and a
    // device that cannot remember an opt-out must not be adopted into one.
    return DEVICE_OPTED_OUT
  }
}

export const isDeviceOptedIn = (uid) => getDeviceOptInState(uid) === DEVICE_OPTED_IN

export const setDeviceOptedIn = (uid) => {
  if (!uid || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEVICE_OPT_IN_KEY(uid), 'true')
  } catch {
    // Ignore write failures; push still works for this session.
  }
}

export const setDeviceOptedOut = (uid) => {
  if (!uid || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEVICE_OPT_IN_KEY(uid), 'false')
  } catch {
    // Ignore write failures; getDeviceOptInState already reports a storage
    // error as an opt-out, so the refresh stays off either way.
  }
}

export const getStoredDeviceToken = (uid) => {
  if (!uid || typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(DEVICE_TOKEN_KEY(uid)) || ''
  } catch {
    return ''
  }
}

export const setStoredDeviceToken = (uid, token) => {
  if (!uid || !token || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEVICE_TOKEN_KEY(uid), token)
  } catch {
    // Ignore write failures
  }
}

export const clearStoredDeviceToken = (uid) => {
  if (!uid || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(DEVICE_TOKEN_KEY(uid))
  } catch {
    // Ignore removal failures
  }
}
