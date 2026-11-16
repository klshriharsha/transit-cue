self.addEventListener('push', (event) => {
  const payload = event.data?.json()
  const title = payload?.title ?? 'TransitCue'
  const options = {
    body: 'You have a transit update.',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    ...payload?.options,
  }

  event.waitUntil(showLatest(title, options))
})

/**
 * Live updates replace each other through a shared `tag`, but push services don't guarantee
 * delivery order. If a newer update for this tag is already on screen, keep it instead of
 * rolling the board back. It's re-shown quietly rather than skipped, because Safari may revoke the
 * subscription of a service worker that handles a push without showing a notification.
 */
async function showLatest(title, options) {
  if (options.tag && options.data?.sentAt) {
    const [current] = await self.registration.getNotifications({ tag: options.tag })

    if (current?.data?.sentAt > options.data.sentAt) {
      return self.registration.showNotification(current.title, {
        body: current.body,
        icon: current.icon,
        badge: current.badge,
        tag: current.tag,
        data: current.data,
        actions: current.actions,
        requireInteraction: current.requireInteraction,
        renotify: false,
        silent: true,
      })
    }
  }

  return self.registration.showNotification(title, options)
}

/** Tells the server to stop pushing updates for this window today. Best-effort. */
async function stopWindow(data) {
  if (!data?.configId || !data?.windowDate) return

  const subscription = await self.registration.pushManager.getSubscription()
  if (!subscription) return

  await fetch(`/api/config/${encodeURIComponent(data.configId)}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, windowDate: data.windowDate }),
  }).catch(() => {})
}

// Swiping a live board away means "I've got it", so the next change must not bring it back.
// Replacing a notification via the same tag, or closing it from code, doesn't fire this event.
self.addEventListener('notificationclose', (event) => {
  if (event.notification.data?.live) event.waitUntil(stopWindow(event.notification.data))
})

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data
  event.notification.close()

  if (event.action === 'stop') {
    event.waitUntil(stopWindow(data))
    return
  }

  // Opening the app doesn't stop updates: the next change shows the board again.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows[0]
      return existing ? existing.focus() : self.clients.openWindow('/')
    }),
  )
})
