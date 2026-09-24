/**
 * Service worker for Web Push.
 *
 * This is what makes a notification possible with no tab open: the browser
 * keeps the worker registered and wakes it when a push arrives, whether or
 * not Fellow Hero is running.
 *
 * Deliberately tiny and does NOT cache anything. A caching service worker on
 * an app behind Cloudflare Access is a good way to serve someone a stale
 * page or a cached redirect to a login screen.
 */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A malformed payload should still produce something useful.
  }

  const title = data.title || 'Meeting starting soon'
  const options = {
    body: data.body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    // One notification per meeting; a repeat replaces rather than stacks.
    tag: data.meetingId ? `fellow-meeting-${data.meetingId}` : 'fellow-meeting',
    data: { meetingId: data.meetingId || null },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const meetingId = event.notification.data && event.notification.data.meetingId
  const target = meetingId ? `/meetings/${meetingId}` : '/calendar'

  // Focus an existing tab if there is one rather than opening a duplicate.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

// Take over immediately on install so the first subscription works without
// requiring a reload.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
