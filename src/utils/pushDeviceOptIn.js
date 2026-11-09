// Which *device* opted into push. On/off is per phone: this marker is the
// source of truth, and the account-level `preferences.pushNotifications` is
// only read to adopt phones that opted in before the marker existed.
//
// The launch-time token refresh cannot key off browser permission alone:
// disablePushNotifications deletes the token but leaves Notification.permission
// granted, so a permission-only gate would resurrect push for someone who
// deliberately turned it off. Hence a device-local signal.
//
// Three states, not two. An explicit opt-out is *recorded* as 'false' rather
// than removed, so a device that said no stays distinguishable from one that
// was never asked. Only the never-asked state is eligible for the one-time
// adoption below — without that distinction, adopting would silently undo
// every opt-out made before the marker existed.

const DEVICE_OPT_IN_KEY = (uid) => `pushDeviceOptIn:${uid}`

export const DEVICE_OPTED_IN = 'in'
export const DEVICE_OPTED_OUT = 'out'
export const DEVICE_OPT_IN_UNKNOWN = 'unknown'

/**
 * Pure launch-refresh decision, split out so the matrix is testable without a
 * browser. All four inputs must hold: the device can register at all, the
 * user granted permission, this device is the one that opted in, and the
 * account preference is on. The app never writes the preference false, so
 * false is an opt-out from before per-phone tokens and must stay off.
 * @param {{eligible: boolean, permission: string, deviceOptedIn: boolean, preferenceEnabled: boolean}} input
 * @returns {boolean}
 */
export const shouldRefreshPushToken = ({
  eligible = false,
  permission = 'default',
  deviceOptedIn = false,
  preferenceEnabled = false
} = {}) => Boolean(eligible) &&
  permission === 'granted' &&
  Boolean(deviceOptedIn) &&
  Boolean(preferenceEnabled)

/**
 * Whether launch should record an opt-out for this phone: it is marked opted
 * in, but the account preference says off. That pairing only comes from
 * before per-phone tokens (an explicit off, or the old logout), and recording
 * it keeps this phone off after the member turns another phone back on.
 * @param {{state: string, preferenceEnabled: boolean}} input
 * @returns {boolean}
 */
export const shouldRecordLaunchOptOut = ({
  state = DEVICE_OPT_IN_UNKNOWN,
  preferenceEnabled = false
} = {}) => state === DEVICE_OPTED_IN && !preferenceEnabled

/**
 * Whether AuthContext may record this uid and call refreshPushToken.
 *
 * onAuthStateChanged sets currentUser before the matching profile loads, so
 * the previous account's profile can still be mounted. Recording the uid
 * against that stale preference would skip the real profile's retry.
 * @param {{uid?: string, profileUid?: string, alreadyRefreshedUid?: string|null}} input
 * @returns {boolean}
 */
export const shouldAttemptLaunchPushRefresh = ({
  uid,
  profileUid,
  alreadyRefreshedUid
} = {}) => Boolean(uid) &&
  profileUid === uid &&
  alreadyRefreshedUid !== uid

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
 * Restricted to the never-asked state: a recorded opt-out is never adopted,
 * and neither is preference-off (account intent, including leftover clears
 * from the old stale-token path).
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

/**
 * Whether an account other than `uid` turned push on in this browser. The FCM
 * token belongs to the browser, not the account, so they share it.
 * @param {string} uid Account being cleaned up
 * @param {Storage} [storage] Defaults to localStorage
 * @returns {boolean}
 */
export const isAnotherAccountOptedIn = (uid, storage = globalThis.localStorage) => {
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key?.startsWith(DEVICE_OPT_IN_KEY('')) && key !== DEVICE_OPT_IN_KEY(uid) &&
        storage.getItem(key) === 'true') return true
    }
  } catch {
    // Storage blocked: no account can be opted in here.
  }
  return false
}

/**
 * Whether this phone receives push, as Profile's switch shows it: opted in, or
 * about to be adopted by the launch refresh (which may land after the page
 * opened), so switching it off still runs the cleanup.
 * @param {string} uid Signed-in member id
 * @param {{preferenceEnabled: boolean, permission: string}} input
 * @returns {boolean}
 */
export const isDevicePushOn = (uid, { preferenceEnabled = false, permission = 'default' } = {}) => {
  const state = getDeviceOptInState(uid)
  return state === DEVICE_OPTED_IN ||
    shouldAdoptLegacyOptIn({ state, preferenceEnabled, permission })
}

// Same-tab marker writes fire this event, so a mounted Profile can follow a
// launch refresh that adopts or opts out this phone after the page opened.
const DEVICE_OPT_IN_EVENT = 'push-device-opt-in-change'

const writeDeviceOptIn = (uid, value) => {
  if (!uid || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEVICE_OPT_IN_KEY(uid), value)
  } catch {
    // Ignore write failures; getDeviceOptInState already reports a storage
    // error as an opt-out, so the refresh stays off either way.
  }
  window.dispatchEvent?.(new Event(DEVICE_OPT_IN_EVENT))
}

export const setDeviceOptedIn = (uid) => writeDeviceOptIn(uid, 'true')

export const setDeviceOptedOut = (uid) => writeDeviceOptIn(uid, 'false')

/** @returns {() => void} Unsubscribe */
export const subscribeDeviceOptIn = (onChange) => {
  window.addEventListener(DEVICE_OPT_IN_EVENT, onChange)
  return () => window.removeEventListener(DEVICE_OPT_IN_EVENT, onChange)
}

const DEVICE_ID_KEY = 'pushDeviceId'

/**
 * This phone's id if it already has one; never creates one. Logout uses it so
 * a phone that never registered doesn't gain an id or send a pointless delete.
 * @returns {string|null}
 */
export const readPushDeviceId = () => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(DEVICE_ID_KEY)
  } catch {
    return null
  }
}

/**
 * This phone's stable id, keying `push_tokens/{uid}/devices/{id}` so a token
 * refresh overwrites the phone's own doc instead of adding one. Per phone, not
 * per uid, and kept across logouts.
 * @returns {string|null} null when storage is blocked: a phone that cannot
 * keep its id cannot keep its doc either, so callers must not register it.
 */
export const getPushDeviceId = () => {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(DEVICE_ID_KEY)
    if (stored) return stored
    const id = window.crypto.randomUUID()
    window.localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return null
  }
}
