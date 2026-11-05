import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import app, { db } from './firebase'
import { firebaseVapidKey } from './firebaseConfig'
import { updateMemberPreferences } from './members'
import { isMobilePushEligible } from '../utils/mobilePushEligibility'
import {
  DEVICE_OPTED_IN,
  DEVICE_OPTED_OUT,
  getDeviceOptInState,
  getPushDeviceId,
  readPushDeviceId,
  setDeviceOptedIn,
  setDeviceOptedOut,
  isDeviceOptedIn,
  shouldAdoptLegacyOptIn,
  shouldRecordLaunchOptOut,
  shouldRefreshPushToken
} from '../utils/pushDeviceOptIn'

export { isMobilePushEligible } from '../utils/mobilePushEligibility'

const PUSH_TOKENS_COLLECTION = 'push_tokens'
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
/** BroadcastChannel for multi-tab “is any peer focused?” queries. */
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
export const canShowPushOptInPrompt = async ({ uid } = {}) => {
  // On/off is per phone: another phone being opted in says nothing about this one.
  if (isDeviceOptedIn(uid)) return false
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

const getDevicePushTokenRef = (uid, deviceId) =>
  doc(db, PUSH_TOKENS_COLLECTION, uid, 'devices', deviceId)

/**
 * The single-token doc from before per-phone tokens. Deleted, never written:
 * once any phone has its own doc, turns off or logs out, the legacy token
 * (possibly a sold or forgotten phone's) must stop receiving.
 */
const deleteLegacyPushToken = (uid) => deleteDoc(doc(db, PUSH_TOKENS_COLLECTION, uid))

/**
 * Writes this phone's device doc, then drops the legacy doc. In that order:
 * during a deploy the old rules refuse the device write, and the legacy doc
 * must keep delivering until a device doc has landed.
 */
const savePushToken = async (uid, deviceId, token) => {
  await setDoc(getDevicePushTokenRef(uid, deviceId), {
    token,
    platform: 'web',
    updatedAt: new Date().toISOString()
  })
  await deleteLegacyPushToken(uid)
}

const deleteBrowserPushToken = async () => {
  if (!(await isPushSupported())) return false
  if (Notification.permission !== 'granted') return false
  const serviceWorkerRegistration = await getServiceWorkerRegistration()
  // No push subscription means no live token to revoke.
  if (!(await serviceWorkerRegistration.pushManager.getSubscription())) return false
  // deleteToken only targets our sw.js after getToken has bound it in this page
  // session; otherwise it registers the SDK's default /firebase-messaging-sw.js,
  // which this app doesn't ship, and throws. With permission granted and a live
  // subscription, getToken returns the existing token without prompting.
  const messaging = await getMessagingInstance(true)
  await getToken(messaging, { vapidKey: firebaseVapidKey, serviceWorkerRegistration })
  return deleteToken(messaging)
}

/**
 * Removes this phone's push: its device doc and the legacy doc. Once no doc
 * holds this phone's token the server can't send to it, so the browser token
 * revoke is best effort and not awaited (it can be a network round trip, and
 * logout must not wait on it). The legacy doc may hold another phone's token
 * that hasn't opened the app since per-phone tokens shipped; that phone gets
 * push again when it next opens the app.
 * Only a phone that granted permission can hold the legacy token, so logging
 * out elsewhere leaves it alone.
 * The deletes run independently: during a deploy the old rules refuse the
 * device delete, and that must not skip the legacy delete.
 */
const clearThisPhonePush = async (uid) => {
  const deviceId = readPushDeviceId()
  const mayHoldLegacyToken = typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  const results = await Promise.allSettled([
    deviceId ? deleteDoc(getDevicePushTokenRef(uid, deviceId)) : null,
    mayHoldLegacyToken ? deleteLegacyPushToken(uid) : null
  ])
  deleteBrowserPushToken().catch((error) => {
    console.warn('Unable to revoke the browser push token:', error)
  })
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
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

export const enablePushNotifications = async (uid) => {
  // A phone that cannot keep its id cannot keep its doc, so it would show off
  // right after enabling and logout could not find what to remove.
  const deviceId = getPushDeviceId()
  if (!deviceId) throw new Error(PUSH_DISABLED_MESSAGE)
  await ensurePushPermission()
  const token = await issuePushToken()

  await savePushToken(uid, deviceId, token)
  // The server sends only to members with the preference on, and launch
  // refresh needs it too. Never written false: off is per phone.
  await updateMemberPreferences(uid, { pushNotifications: true })
  // Marked only after the writes land, so a half-failed opt-in does not leave a
  // device claiming an opt-in it never completed.
  setDeviceOptedIn(uid)
  await ensureForegroundPushListener()

  return token
}

/**
 * Re-issues this device's FCM token on an authenticated launch.
 *
 * FCM web tokens die routinely — cleared site data, a reinstalled PWA, the push
 * service resubscribing — and the server deletes the stored token on the first
 * failed send. Without this, a phone stays opted in (its marker) but never
 * delivers again. The account preference gates it: the app never writes it
 * false, so false is an opt-out from before per-phone tokens, recorded here
 * on this phone so it stays off. This refresh never writes the preference.
 *
 * Deliberately never calls requestPermission: a launch-time permission prompt
 * is exactly the behavior the opt-in banner exists to avoid.
 * @param {string} uid Signed-in member id
 * @param {{preferenceEnabled?: boolean}} [options] Cached member preference
 * @returns {Promise<boolean>} True when a token was written
 */
export const refreshPushToken = async (uid, { preferenceEnabled = false } = {}) => {
  const state = getDeviceOptInState(uid)
  if (state === DEVICE_OPTED_OUT) return false
  if (shouldRecordLaunchOptOut({ state, preferenceEnabled })) {
    setDeviceOptedOut(uid)
    return false
  }

  const permission = typeof Notification === 'undefined'
    ? 'default'
    : Notification.permission
  // Devices that opted in before the marker shipped carry no marker at all.
  // They are exactly the population already sitting on a dead token, so adopt
  // them once from the preference plus a granted permission.
  const deviceOptedIn = state === DEVICE_OPTED_IN ||
    shouldAdoptLegacyOptIn({ state, preferenceEnabled, permission })
  if (!deviceOptedIn) return false

  const eligible = await isPushSupported()
  if (!shouldRefreshPushToken({ eligible, permission, deviceOptedIn, preferenceEnabled })) return false
  if (!firebaseVapidKey) return false
  const deviceId = getPushDeviceId()
  if (!deviceId) return false

  const token = await issuePushToken()
  await savePushToken(uid, deviceId, token)
  // Recorded only once the token write landed, mirroring enablePushNotifications:
  // a half-failed adoption must not leave a device claiming an opt-in.
  if (state !== DEVICE_OPTED_IN) setDeviceOptedIn(uid)
  // AuthContext gates the listener on the marker, which an adopted phone only
  // gets here; without this its first session shows Chrome's default shell.
  await ensureForegroundPushListener()
  return true
}

/** Profile switch off: this phone only, recorded so launch refresh stays off. */
export const disablePushNotifications = async (uid) => {
  stopForegroundPushListener()
  setDeviceOptedOut(uid)
  await clearThisPhonePush(uid)
}

/**
 * Logout: removes this phone's push whatever its marker says (a phone not yet
 * adopted can still hold a live token), but keeps the marker so logging back
 * in re-registers without a permission prompt.
 */
export const disablePushNotificationsOnLogout = async (uid) => {
  if (!isMobilePushEligible()) return false
  stopForegroundPushListener()
  await clearThisPhonePush(uid)
  return true
}
