import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import app, { db } from './firebase'
import { firebaseVapidKey } from './firebaseConfig'
import { updateMemberPreferences } from './members'

const PUSH_TOKENS_COLLECTION = 'push_tokens'
const PUSH_DISABLED_MESSAGE = 'Push notifications are not available in this browser.'
const PUSH_PERMISSION_MESSAGE = 'Push notifications are blocked in your browser settings.'
const PUSH_CONFIG_MESSAGE = 'Push notifications are not configured for this app.'
const PUSH_TOKEN_MESSAGE = 'Unable to create a push token for this browser.'

export const isPushSupported = async () => {
  if (typeof window === 'undefined') return false
  if (!import.meta.env.PROD) return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  return isSupported()
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

  return token
}

export const disablePushNotifications = async (uid) => {
  await deleteBrowserPushToken().catch(() => false)
  await removeStoredPushToken(uid)
  await updateMemberPreferences(uid, { pushNotifications: false })
}
