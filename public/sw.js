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

const app = initializeApp(firebaseConfig)
try {
  const messaging = getMessaging(app)
  onBackgroundMessage(messaging, (payload) => {
    const data = payload.data || {}
    const title = data.title || payload.notification?.title || 'Da Nang Blockchain Hub'
    const body = data.body || payload.notification?.body || ''
    const targetUrl = data.link || '/'

    self.registration.showNotification(title, {
      body,
      icon: '/assets/favicon/android-chrome-192x192.png',
      badge: '/assets/favicon/favicon-32x32.png',
      data: {
        url: targetUrl
      },
      tag: data.tag || `${data.type || 'notification'}-${data.subjectId || 'default'}`,
      renotify: true
    })
  })
} catch (error) {
  console.warn('[sw] Firebase messaging unavailable:', error)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/'
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
