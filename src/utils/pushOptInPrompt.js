import { canShowPushOptInPrompt } from '../services/pushNotifications'

const DISMISS_COUNT_KEY = (uid) => `pushOptInDismissCount:${uid}`
const MAX_MANUAL_DISMISSES = 3
const TOAST_MS = 3000
const GAP_MS = 400

const listeners = new Set()
let visibleState = null
let pendingTimer = null

const notify = () => {
  listeners.forEach((listener) => listener(visibleState))
}

const getDismissCount = (uid) => {
  if (!uid || typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(DISMISS_COUNT_KEY(uid))
  const count = Number.parseInt(raw, 10)
  return Number.isFinite(count) && count > 0 ? count : 0
}

const isStopped = (uid) => getDismissCount(uid) >= MAX_MANUAL_DISMISSES

const recordManualDismiss = (uid) => {
  if (!uid || typeof window === 'undefined') return
  const next = Math.min(getDismissCount(uid) + 1, MAX_MANUAL_DISMISSES)
  window.localStorage.setItem(DISMISS_COUNT_KEY(uid), String(next))
}

const openBanner = (uid) => {
  if (!uid || visibleState) return
  visibleState = { uid }
  notify()
}

export const subscribePushOptIn = (listener) => {
  listeners.add(listener)
  listener(visibleState)
  return () => listeners.delete(listener)
}

export const closePushOptInBanner = ({ countDismiss = false } = {}) => {
  if (!visibleState) return
  if (countDismiss) recordManualDismiss(visibleState.uid)
  visibleState = null
  notify()
}

export const cancelScheduledPushOptIn = () => {
  if (pendingTimer == null) return
  clearTimeout(pendingTimer)
  pendingTimer = null
}

/** Drop pending timer and hide banner (e.g. on logout). */
export const resetPushOptInPrompt = () => {
  cancelScheduledPushOptIn()
  closePushOptInBanner({ countDismiss: false })
}

/**
 * After a success toast, maybe show the push opt-in drop-in.
 * Call from mutation onSuccess only.
 */
export const promptPushOptInAfterSuccess = (uid, optedIn = false) => {
  if (!uid || optedIn || isStopped(uid)) return
  cancelScheduledPushOptIn()
  pendingTimer = setTimeout(async () => {
    pendingTimer = null
    if (visibleState || isStopped(uid)) return
    try {
      if (!(await canShowPushOptInPrompt({ optedIn }))) return
    } catch {
      return
    }
    openBanner(uid)
  }, TOAST_MS + GAP_MS)
}
