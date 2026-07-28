import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import app, { db } from './firebase'
import { firebaseVapidKey } from './firebaseConfig'
import { updateMemberPreferences } from './members'

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

const getPushTokenRef = (uid) => doc(db, PUSH_TOKENS_COLLECTION, uid)

const savePushToken = async (uid, token) => {
  await setDoc(getPushTokenRef(uid), {
    token,
    platform: 'web',
    updatedAt: new Date().toISOString()
  }, { merge: true })
}

const removeStoredPushToken = async (uid) => {
  await deleteDoc(getPushTokenRef(uid))
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

export const enablePushNotifications = async (uid) => {
  await ensurePushPermission()
  const messaging = await getMessagingInstance(true)
  const serviceWorkerRegistration = await getServiceWorkerRegistration()
  const token = await getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration
  })

  if (!token) {
    throw new Error(PUSH_TOKEN_MESSAGE)
  }

  await savePushToken(uid, token)
  await updateMemberPreferences(uid, { pushNotifications: true })
  await ensureForegroundPushListener()

  return token
}

export const disablePushNotifications = async (uid) => {
  stopForegroundPushListener()
  await removeStoredPushToken(uid)
  await updateMemberPreferences(uid, { pushNotifications: false })
  await deleteBrowserPushToken().catch(() => false)
}

export const disablePushNotificationsOnLogout = async (uid) => {
  await disablePushNotifications(uid)
}
