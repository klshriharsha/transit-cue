self.addEventListener('push', (event) => {
  const payload = event.data?.json()
  const title = payload?.title ?? 'Onward'

  event.waitUntil(
    self.registration.showNotification(title, {
      body: 'You have a transit update.',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      ...payload?.options,
    }),
  )
})
