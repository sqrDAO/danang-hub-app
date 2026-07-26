import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { firebaseConfig } from '../src/services/firebaseConfig.js'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const createCachePlugins = (maxEntries, maxAgeSeconds) => [
  new CacheableResponsePlugin({ statuses: [0, 200] }),
  new ExpirationPlugin({
    maxEntries,
    maxAgeSeconds
  })
]

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: createCachePlugins(10, 60 * 60 * 24 * 365)
  })
)

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: createCachePlugins(10, 60 * 60 * 24 * 365)
  })
)

registerRoute(
  ({ url }) => url.origin === 'https://firebasestorage.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'firebase-storage-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7
      })
    ]
  })
)

const HUB_ICON = '/assets/favicon/android-chrome-192x192.png'
const HUB_BADGE = '/assets/favicon/favicon-32x32.png'
const DEFAULT_PUSH_TITLE = 'Da Nang Blockchain Hub'

const resolvePushContent = (payload) => {
  const data = payload?.data || {}
  return {
    title: data.title || payload?.notification?.title || DEFAULT_PUSH_TITLE,
    body: data.body || payload?.notification?.body || '',
    targetUrl: data.link || '/',
    tag: data.tag || `${data.type || 'notification'}-${data.subjectId || 'default'}`
  }
}

const showHubNotification = ({ title, body, targetUrl, tag }) =>
  self.registration.showNotification(title, {
    body,
    icon: HUB_ICON,
    badge: HUB_BADGE,
    data: { url: targetUrl },
    tag,
    renotify: true
  })

/** Click URL from our SW-shown notifications or FCM auto-displayed ones. */
const resolveNotificationClickUrl = (notification) => {
  const data = notification?.data || {}
  if (typeof data.url === 'string' && data.url) return data.url
  const fcm = data.FCM_MSG
  if (fcm && typeof fcm === 'object') {
    if (typeof fcm.data?.link === 'string' && fcm.data.link) return fcm.data.link
    if (typeof fcm.fcmOptions?.link === 'string' && fcm.fcmOptions.link) {
      return fcm.fcmOptions.link
    }
  }
  return '/'
}

const app = initializeApp(firebaseConfig)
try {
  const messaging = getMessaging(app)
  onBackgroundMessage(messaging, (payload) => {
    // FCM already called showNotification when a notification payload is present
    // (including webpush.notification from the server). Only handle pure data.
    if (payload.notification?.title || payload.notification?.body) {
      return undefined
    }
    return showHubNotification(resolvePushContent(payload))
  })
} catch (error) {
  console.warn('[sw] Firebase messaging unavailable:', error)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = resolveNotificationClickUrl(event.notification)
  const absoluteUrl = new URL(targetUrl, self.location.origin).href

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windowClients) {
      if (client.url === absoluteUrl && 'focus' in client) {
        return client.focus()
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(absoluteUrl)
    }
    return undefined
  })())
})
