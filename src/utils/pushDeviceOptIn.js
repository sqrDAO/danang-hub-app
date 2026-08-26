// Which *device* opted into push, kept separate from the account-level
// `preferences.pushNotifications` mirror on the member doc.
//
// The launch-time token refresh cannot key off browser permission alone:
// disablePushNotifications deletes the token but leaves Notification.permission
// granted, so a permission-only gate would resurrect push for someone who
// deliberately turned it off. The account preference is the other gate: a
// dead token must not be treated as opt-out, and a phone with this marker
// must not treat a desktop (or any) preference-off as something to heal.
// Hence a third, device-local signal.
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
 * browser. All four inputs must hold: the device can register at all, the user
 * granted permission, this device is the one that opted in, and the account
 * still wants push. Preference-off is account intent — do not re-issue a token
 * that would then be ignored, and do not treat it as something to heal.
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
 * Whether Profile save should call enablePushNotifications.
 *
 * Turning the box on always enables. Leaving it on also enables when this
 * device has no opt-in marker, so a ticked box is not a no-op after a PWA
 * reinstall (permission reset, marker gone, token already deleted). Desktop
 * is excluded: enablePushNotifications throws there, and a name-only save
 * must not fail because of that.
 * @param {{desired?: boolean, current?: boolean, deviceOptedIn?: boolean, mobileEligible?: boolean}} input
 * @returns {boolean}
 */
export const shouldEnablePushOnSave = ({
  desired = false,
  current = false,
  deviceOptedIn = false,
  mobileEligible = false
} = {}) => {
  if (!desired) return false
  if (desired !== current) return true
  return Boolean(mobileEligible) && !deviceOptedIn
}

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
