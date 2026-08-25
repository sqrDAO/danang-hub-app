import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import app, { db } from './firebase'
import { firebaseVapidKey } from './firebaseConfig'
import { updateMemberPreferences } from './members'
import { isMobilePushEligible } from '../utils/mobilePushEligibility'
import {
  DEVICE_OPTED_IN,
  DEVICE_OPTED_OUT,
  clearStoredDeviceToken,
  getDeviceOptInState,
  getStoredDeviceToken,
  setDeviceOptedIn,
  setDeviceOptedOut,
  setStoredDeviceToken,
  shouldAdoptLegacyOptIn,
  shouldRefreshPushToken
} from '../utils/pushDeviceOptIn'
import {
  hashPushToken,
  MAX_PUSH_DEVICES_PER_MEMBER,
  previousTokenToReplace,
  pushTokenIdsToPrune
} from '../utils/pushDeviceToken'

export { isMobilePushEligible } from '../utils/mobilePushEligibility'
export {
  hashPushToken,
  MAX_PUSH_DEVICES_PER_MEMBER
} from '../utils/pushDeviceToken'

const PUSH_DISABLED_MESSAGE = 'Push notifications are not available in this browser.'
const PUSH_PERMISSION_MESSAGE = 'Push notifications are blocked in your browser settings.'
const PUSH_CONFIG_MESSAGE = 'Push notifications are not configured for this app.'
const PUSH_TOKEN_MESSAGE = 'Unable to create a push token for this browser.'
const HUB_ICON = '/assets/favicon/android-chrome-192x192.png'
const HUB_BADGE = '/assets/favicon/favicon-32x32.png'
const DEFAULT_PUSH_TITLE = 'Da Nang Blockchain Hub'

/** Unsubscribe for the singleton foreground push listener, if active. */
let stopForegroundListener = null
/** Shared in-flight ensure so concurrent callers do not double-register. */
let ensureForegroundPromise = null
/**
 * Bumped by stopForegroundPushListener so an in-flight ensure abandons
 * instead of registering after disable/logout/effect cleanup.
 */
let foregroundListenerGeneration = 0
/** BroadcastChannel for multi-tab "is any peer focused?" queries. */
let pushFocusChannel = null
const PUSH_FOCUS_CHANNEL = 'hub-push-focus'
const PUSH_SHOW_LOCK = 'hub-push-foreground-show'
const FOCUS_QUERY_MS = 40

export const isPushSupported = async () => {
  if (typeof window === 'undefined') return false
  if (!isMobilePushEligible()) return false
  if (!import.meta.env.PROD) return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  return isSupported()
}

/** Whether the soft post-success prompt may be shown. */
export const canShowPushOptInPrompt = async ({ optedIn = false } = {}) => {
  if (optedIn) return false
  if (!(await isPushSupported())) return false
  if (!firebaseVapidKey) return false
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return false
  }
  return true
}

const getMessagingInstance = async (requireVapid = true) => {
  if (!(await isPushSupported())) {
    throw new Error(PUSH_DISABLED_MESSAGE)
  }
  if (requireVapid && !firebaseVapidKey) {
    throw new Error(PUSH_CONFIG_MESSAGE)
  }
  return getMessaging(app)
}

const ensurePushPermission = async () => {
  if (typeof Notification === 'undefined') {
    throw new Error(PUSH_DISABLED_MESSAGE)
  }
  if (Notification.permission === 'granted') return
  if (Notification.permission === 'denied') {
    throw new Error(PUSH_PERMISSION_MESSAGE)
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(PUSH_PERMISSION_MESSAGE)
  }
}

const getServiceWorkerRegistration = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error(PUSH_DISABLED_MESSAGE)
  }
  return navigator.serviceWorker.ready
}

/**
 * Deletes a specific FCM token document from the member's push_tokens subcollection.
 * @param {string} uid Member id
 * @param {string} token Raw FCM token to remove
 */
const removeStoredPushToken = async (uid, token) => {
  if (!uid || !token) return
  const tokenId = await hashPushToken(token)
  const tokenRef = doc(db, 'members', uid, 'push_tokens', tokenId)
  await deleteDoc(tokenRef)
}

/**
 * Deletes the oldest push token documents when the subcollection is over
 * capacity. Runs after the incoming token is written so concurrent
 * registrations self-heal. The incoming id is never evicted.
 *
 * Non-blocking: pruning failures are logged but never thrown so that the
 * calling registration always completes.
 * @param {string} uid Member id
 * @param {string} incomingTokenId The hashed id of the token being saved
 */
const pruneOldestPushTokens = async (uid, incomingTokenId) => {
  try {
    const tokensCol = collection(db, 'members', uid, 'push_tokens')
    const snap = await getDocs(tokensCol)
    if (snap.empty) return

    const docs = []
    snap.forEach((d) => {
      const data = d.data() || {}
      docs.push({
        id: d.id,
        ref: d.ref,
        updatedAt: data.updatedAt,
        createdAt: data.createdAt
      })
    })

    const ids = pushTokenIdsToPrune(docs, incomingTokenId, MAX_PUSH_DEVICES_PER_MEMBER)
    if (!ids.length) return
    const refsById = new Map(docs.map((d) => [d.id, d.ref]))
    await Promise.all(ids.map((id) => deleteDoc(refsById.get(id))))
  } catch (error) {
    console.warn('Unable to prune excess push tokens', error)
  }
}

/**
 * Persists an FCM token to the member's push_tokens subcollection.
 *
 * Uses the token's SHA-256 hash as the document id so writes are idempotent:
 * saving the same token twice merges without creating a duplicate. A rotated
 * token deletes this browser's previous doc first, then prunes overflow.
 * @param {string} uid Member id
 * @param {string} token Raw FCM token
 */
const savePushToken = async (uid, token) => {
  if (!uid || !token) return

  // Read the cached token *before* overwriting it. An FCM rotation must
  // delete this browser's previous doc so prune does not treat the new hash
  // as a 6th device and evict someone else.
  const rotated = previousTokenToReplace(getStoredDeviceToken(uid), token)
  if (rotated) {
    await removeStoredPushToken(uid, rotated).catch(() => {
      console.warn('Could not delete rotated push token; it will be pruned if stale.')
    })
  }

  const tokenId = await hashPushToken(token)
  const tokenRef = doc(db, 'members', uid, 'push_tokens', tokenId)
  const existing = await getDoc(tokenRef)
  const isNew = !existing.exists()
  const now = new Date().toISOString()
  const payload = {
    token,
    platform: 'web',
    updatedAt: now
  }
  if (isNew) {
    payload.createdAt = now
  }
  await setDoc(tokenRef, payload, { merge: true })
  setStoredDeviceToken(uid, token)
  await pruneOldestPushTokens(uid, tokenId)
}

const deleteBrowserPushToken = async () => {
  if (!(await isPushSupported())) return false
  const messaging = getMessaging(app)
  return deleteToken(messaging)
}

const resolvePushContent = (payload) => {
  const data = payload?.data || {}
  return {
    title: data.title || payload?.notification?.title || DEFAULT_PUSH_TITLE,
    body: data.body || payload?.notification?.body || '',
    targetUrl: data.link || '/',
    tag: data.tag || `${data.type || 'notification'}-${data.subjectId || 'default'}`
  }
}

const startPushFocusChannel = () => {
  if (pushFocusChannel || typeof BroadcastChannel === 'undefined') return
  pushFocusChannel = new BroadcastChannel(PUSH_FOCUS_CHANNEL)
  pushFocusChannel.onmessage = (event) => {
    if (event.data?.type === 'focus-query' && document.hasFocus()) {
      pushFocusChannel.postMessage({ type: 'focus-claim' })
    }
  }
}

const stopPushFocusChannel = () => {
  if (!pushFocusChannel) return
  try {
    pushFocusChannel.close()
  } catch {
    // ignore
  }
  pushFocusChannel = null
}

/** True if another same-origin tab reports focus (BroadcastChannel ping). */
const peerTabHasFocus = () => {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false)
  startPushFocusChannel()
  if (!pushFocusChannel) return Promise.resolve(false)

  return new Promise((resolve) => {
    let found = false
    const onMessage = (event) => {
      if (event.data?.type === 'focus-claim') found = true
    }
    pushFocusChannel.addEventListener('message', onMessage)
    pushFocusChannel.postMessage({ type: 'focus-query' })
    setTimeout(() => {
      pushFocusChannel?.removeEventListener('message', onMessage)
      resolve(found)
    }, FOCUS_QUERY_MS)
  })
}

const displaySystemNotification = async (payload) => {
  const { title, body, targetUrl, tag } = resolvePushContent(payload)
  const registration = await getServiceWorkerRegistration()
  // Re-check after await — user may have focused this tab during registration lookup.
  if (typeof document !== 'undefined' && document.hasFocus()) return
  if (await peerTabHasFocus()) return
  await registration.showNotification(title, {
    body,
    icon: HUB_ICON,
    badge: HUB_BADGE,
    data: { url: targetUrl },
    tag,
    renotify: true
  })
}

/**
 * When a tab is open, FCM delivers to onMessage instead of the SW. Chrome still
 * requires a system notification if the page is not focused — otherwise it
 * injects the default "site updated in the background" shell.
 * Skips when this tab or any peer tab is focused; multi-unfocused tabs elect
 * one shower via navigator.locks when available.
 */
const showForegroundSystemNotification = async (payload) => {
  if (typeof document !== 'undefined' && document.hasFocus()) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return
  }
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    await navigator.locks.request(PUSH_SHOW_LOCK, { ifAvailable: true }, async (lock) => {
      if (!lock) return
      await displaySystemNotification(payload)
    })
    return
  }
  await displaySystemNotification(payload)
}

/**
 * Idempotent: ensures a single onMessage handler is registered for this page.
 * Concurrent callers share one in-flight promise; stop() bumps a generation so
 * an ensure that loses a race never leaves a live listener behind.
 * @returns {Promise<(() => void)|void>}
 */
export const ensureForegroundPushListener = async () => {
  if (stopForegroundListener) return stopForegroundListener
  if (ensureForegroundPromise) return ensureForegroundPromise

  const generation = foregroundListenerGeneration
  ensureForegroundPromise = (async () => {
    try {
      if (!(await isPushSupported())) return undefined
      if (generation !== foregroundListenerGeneration) return undefined
      if (stopForegroundListener) return stopForegroundListener

      startPushFocusChannel()
      const messaging = getMessaging(app)
      const unsubscribe = onMessage(messaging, (payload) => {
        showForegroundSystemNotification(payload).catch((error) => {
          console.warn('Unable to show foreground push notification:', error)
        })
      })

      if (generation !== foregroundListenerGeneration) {
        unsubscribe()
        stopPushFocusChannel()
        return undefined
      }

      stopForegroundListener = () => {
        unsubscribe()
        stopPushFocusChannel()
      }
      return stopForegroundListener
    } finally {
      ensureForegroundPromise = null
    }
  })()

  return ensureForegroundPromise
}

export const stopForegroundPushListener = () => {
  foregroundListenerGeneration += 1
  if (!stopForegroundListener) {
    stopPushFocusChannel()
    return
  }
  try {
    stopForegroundListener()
  } finally {
    // Always clear so a throwing unsubscribe cannot block re-register.
    stopForegroundListener = null
    stopPushFocusChannel()
  }
}

/** Mints a fresh FCM token against the active service worker registration. */
const issuePushToken = async () => {
  const messaging = await getMessagingInstance(true)
  const serviceWorkerRegistration = await getServiceWorkerRegistration()
  const token = await getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration
  })

  if (!token) {
    throw new Error(PUSH_TOKEN_MESSAGE)
  }
  return token
}

/**
 * Registers this device for push without touching the account-level preference.
 *
 * Used by the Profile "This Device" toggle and the post-booking opt-in banner.
 * Callers that also want to set preferences.pushNotifications = true should use
 * enablePushNotifications instead.
 * @param {string} uid Member id
 * @returns {Promise<string>} The minted FCM token
 */
export const enableDevicePushNotifications = async (uid) => {
  await ensurePushPermission()
  const token = await issuePushToken()

  await savePushToken(uid, token)
  // Marked only after the writes land, so a half-failed opt-in does not leave a
  // device claiming an opt-in it never completed.
  setDeviceOptedIn(uid)
  await ensureForegroundPushListener()

  return token
}

/**
 * Registers this device and sets the account-level push preference to true.
 *
 * Used by the Profile Preferences form when toggling push on. For device-only
 * registration without touching the preference, use enableDevicePushNotifications.
 * @param {string} uid Member id
 * @returns {Promise<string>} The minted FCM token
 */
export const enablePushNotifications = async (uid) => {
  const token = await enableDevicePushNotifications(uid)
  await updateMemberPreferences(uid, { pushNotifications: true })
  return token
}

/**
 * Re-issues this device's FCM token on an authenticated launch.
 *
 * FCM web tokens die routinely — cleared site data, a reinstalled PWA, the push
 * service resubscribing. Re-issuing the token keeps this device's token document
 * in members/{uid}/push_tokens/{tokenId} fresh and active.
 *
 * Deliberately never calls requestPermission: a launch-time permission prompt
 * is exactly the behavior the opt-in banner exists to avoid.
 *
 * Never restores or modifies the account-level preference: that field is
 * exclusively user-controlled.
 * @param {string} uid Signed-in member id
 * @param {{preferenceEnabled?: boolean}} [options] Cached member preference
 * @returns {Promise<void>}
 */
export const refreshPushToken = async (uid, { preferenceEnabled = false } = {}) => {
  const state = getDeviceOptInState(uid)
  if (state === DEVICE_OPTED_OUT) return

  const permission = typeof Notification === 'undefined'
    ? 'default'
    : Notification.permission
  // Devices that opted in before the marker shipped carry no marker at all.
  // They are exactly the population already sitting on a dead token, so adopt
  // them once from the preference plus a granted permission.
  const deviceOptedIn = state === DEVICE_OPTED_IN ||
    shouldAdoptLegacyOptIn({ state, preferenceEnabled, permission })
  if (!deviceOptedIn) return

  const eligible = await isPushSupported()
  if (!shouldRefreshPushToken({ eligible, permission, deviceOptedIn })) return
  if (!firebaseVapidKey) return

  const token = await issuePushToken()
  await savePushToken(uid, token)
  // Recorded only once the token write landed, mirroring enableDevicePushNotifications:
  // a half-failed adoption must not leave a device claiming an opt-in.
  if (state !== DEVICE_OPTED_IN) setDeviceOptedIn(uid)
}

/**
 * Disables push on this specific device only. Does NOT modify
 * preferences.pushNotifications — other devices remain active if the account
 * preference stays true.
 *
 * Local state is committed first (before any async work) so that a network
 * error during Firestore cleanup cannot leave this device thinking it is still
 * opted in.
 * @param {string} uid Member id
 */
export const disableDevicePushNotifications = async (uid) => {
  // 1. Commit local state synchronously before any async work that could throw.
  stopForegroundPushListener()
  setDeviceOptedOut(uid)

  // 2. Retrieve the cached token, then clear it from localStorage.
  const cachedToken = getStoredDeviceToken(uid)
  clearStoredDeviceToken(uid)

  // 3. Remove the Firestore token document. Best-effort: a network failure
  //    here is recoverable — the server will prune the stale token on the
  //    next failed send attempt.
  if (cachedToken) {
    await removeStoredPushToken(uid, cachedToken).catch(() => {
      console.warn('Could not delete push token doc; it will be pruned on next stale send.')
    })
  }

  // 4. Tell FCM to unsubscribe this browser's push subscription.
  await deleteBrowserPushToken().catch(() => false)
}

/**
 * Disables push on this device and turns off the account-level preference.
 *
 * Used by the Profile Preferences form when toggling push off. For device-only
 * deregistration without touching the account preference, use
 * disableDevicePushNotifications directly.
 * @param {string} uid Member id
 */
export const disablePushNotifications = async (uid) => {
  await disableDevicePushNotifications(uid)
  await updateMemberPreferences(uid, { pushNotifications: false })
}

export const disablePushNotificationsOnLogout = async (uid) => {
  if (!isMobilePushEligible()) return false
  await disableDevicePushNotifications(uid)
  return true
}
