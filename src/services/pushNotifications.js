import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import app, { auth, db } from './firebase'
import { firebaseVapidKey } from './firebaseConfig'
import { updateMemberPreferences } from './members'
import { isMobilePushEligible } from '../utils/mobilePushEligibility'
import { getHomeScreenInstallHint } from '../utils/iosInstallHint'
import {
  DEVICE_OPTED_IN,
  DEVICE_OPTED_OUT,
  getDeviceOptInState,
  getPushDeviceId,
  setDeviceOptedIn,
  setDeviceOptedOut,
  isDeviceOptedIn,
  shouldAdoptLegacyOptIn,
  shouldRecordLaunchOptOut,
  shouldRefreshPushToken
} from '../utils/pushDeviceOptIn'

import { createForegroundListener } from './pushForegroundListener'
import { pushLifecycleError, revokePushSubscription } from './pushTokenLifecycle'
import { createPushRegistrationLifecycle } from './pushRegistrationLifecycle'

export { isMobilePushEligible } from '../utils/mobilePushEligibility'

const PUSH_TOKENS_COLLECTION = 'push_tokens'
const PUSH_DISABLED_MESSAGE = 'Push notifications are not available in this browser.'
const PUSH_CONFIG_MESSAGE = 'Push notifications are not configured for this app.'
const PUSH_TOKEN_MESSAGE = 'Unable to create a push token for this browser.'
const HUB_ICON = '/assets/favicon/android-chrome-192x192.png'
const HUB_BADGE = '/assets/favicon/favicon-32x32.png'
const DEFAULT_PUSH_TITLE = 'Da Nang Blockchain Hub'

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

/**
 * For a phone without push: 'install' (iPhone tab, add to Home Screen first),
 * 'safari' (iPhone in-app browser, open in Safari first), or null. Needs the
 * VAPID key, since push can't work after installing without it.
 */
export const getPushInstallHint = () => (firebaseVapidKey ? getHomeScreenInstallHint() : null)

/**
 * Which soft post-success prompt to show: 'enable' (tap turns push on),
 * an install hint (see getPushInstallHint), or null.
 */
export const getPushOptInPromptMode = async ({ uid } = {}) => {
  // On/off is per phone: another phone being opted in says nothing about this one.
  if (isDeviceOptedIn(uid)) return null
  if (!firebaseVapidKey) return null
  // Hint only when push really is missing, so an installed app that can push
  // always gets 'enable', whatever its user agent says.
  if (!(await isPushSupported())) return getPushInstallHint()
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return null
  }
  return 'enable'
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
    throw pushLifecycleError('permission-denied')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw pushLifecycleError(permission === 'denied' ? 'permission-denied' : 'permission-dismissed')
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
const savePushToken = async (uid, deviceId, token, assertCurrent) => {
  assertCurrent()
  await setDoc(getDevicePushTokenRef(uid, deviceId), {
    token,
    platform: 'web',
    updatedAt: new Date().toISOString()
  })
  assertCurrent()
  await deleteLegacyPushToken(uid)
}

const deleteBrowserPushToken = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  if (registration) await revokePushSubscription(registration)
}

const deletePhoneTokenDocuments = (uid, deviceId = getPushDeviceId({ create: false })) => {
  const mayHoldLegacyToken = typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  return [
    deviceId ? deleteDoc(getDevicePushTokenRef(uid, deviceId)) : null,
    mayHoldLegacyToken ? deleteLegacyPushToken(uid) : null
  ]
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

const foregroundListener = createForegroundListener({
  isSupported: isPushSupported,
  start: () => {
    startPushFocusChannel()
    return onMessage(getMessaging(app), (payload) => {
      showForegroundSystemNotification(payload).catch((error) => {
        console.warn('Unable to show foreground push notification:', error)
      })
    })
  },
  onStop: stopPushFocusChannel
})

export const ensureForegroundPushListener = foregroundListener.ensure
export const stopForegroundPushListener = foregroundListener.stop

/** Mints a fresh FCM token against the active service worker registration. */
const issuePushToken = async (assertCurrent) => {
  const messaging = await getMessagingInstance(true)
  assertCurrent()
  const serviceWorkerRegistration = await getServiceWorkerRegistration()
  assertCurrent()
  const token = await getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration
  })

  if (!token) {
    throw new Error(PUSH_TOKEN_MESSAGE)
  }
  return token
}

const pushRegistration = createPushRegistrationLifecycle({
  currentUid: () => auth.currentUser?.uid,
  issue: issuePushToken,
  save: savePushToken,
  remove: deletePhoneTokenDocuments,
  revoke: deleteBrowserPushToken
})

export const enablePushNotifications = (uid) => pushRegistration.register(uid, {
  permission: ensurePushPermission,
  prepare: async () => {
    const deviceId = getPushDeviceId()
    if (!deviceId) throw new Error(PUSH_DISABLED_MESSAGE)
    return deviceId
  },
  // Off is per phone; enabling is the only path writing this preference.
  commit: (memberId) => updateMemberPreferences(memberId, { pushNotifications: true }),
  mark: setDeviceOptedIn
})

const prepareLaunchRefresh = async (uid, preferenceEnabled) => {
  const state = getDeviceOptInState(uid)
  if (state === DEVICE_OPTED_OUT) return false
  if (shouldRecordLaunchOptOut({ state, preferenceEnabled })) {
    setDeviceOptedOut(uid)
    return false
  }
  const permission = typeof Notification === 'undefined' ? 'default' : Notification.permission
  const deviceOptedIn = state === DEVICE_OPTED_IN ||
    shouldAdoptLegacyOptIn({ state, preferenceEnabled, permission })
  if (!deviceOptedIn || !firebaseVapidKey) return false
  const eligible = await isPushSupported()
  if (!shouldRefreshPushToken({ eligible, permission, deviceOptedIn, preferenceEnabled })) return false
  return getPushDeviceId()
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
export const refreshPushToken = async (uid, { preferenceEnabled = false } = {}) =>
  Boolean(await pushRegistration.register(uid, {
    prepare: () => prepareLaunchRefresh(uid, preferenceEnabled),
    mark: setDeviceOptedIn
  }))

/**
 * Off records intent immediately. A failed document delete leaves it Off when
 * revocation succeeded; only a failed revoke restores On for the same session.
 */
export const disablePushNotifications = async (uid) => {
  stopForegroundPushListener()
  setDeviceOptedOut(uid)
  await pushRegistration.clear(uid, {
    onRevoked: () => setDeviceOptedOut(uid),
    onRevokeFailed: () => setDeviceOptedIn(uid)
  })
}

/**
 * Logout: removes this phone's push whatever its marker says (a phone not yet
 * adopted can still hold a live token), but keeps the marker so logging back
 * in re-registers without a permission prompt.
 */
export const disablePushNotificationsOnLogout = async (uid) => {
  if (!isMobilePushEligible()) return false
  stopForegroundPushListener()
  await pushRegistration.clear(uid)
  return true
}
