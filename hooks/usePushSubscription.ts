'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(value: string) {
  const paddedValue = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  const base64 = paddedValue.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from(rawData, (character) => character.charCodeAt(0))
}

function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function subscribePush(subscription: PushSubscription): Promise<void> {
  const response = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  })

  if (!response.ok) {
    throw new Error('The API could not save the push subscription.')
  }
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // True until the first client-side check of permission + existing subscription
  // settles, so the UI can show a loading state instead of flashing the
  // "not enabled" layout and then snapping to the real one.
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (!isPushSupported()) {
      Promise.resolve().then(() => {
        if (!cancelled) setInitializing(false)
      })
      return () => {
        cancelled = true
      }
    }

    Promise.resolve().then(() => {
      if (!cancelled) setPermission(Notification.permission)
    })

    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => registration.pushManager.getSubscription())
      .then((existing) => {
        if (!cancelled && existing) setSubscription(existing)
      })
      .catch(() => {
        // No existing subscription to restore; the user can still opt in manually.
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const subscribe = async () => {
    if (!isPushSupported()) {
      setError('Push notifications are not supported in this browser.')
      return
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidPublicKey) {
      setError('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') {
        setError('Notification permission was not granted.')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const pushSubscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }))

      await subscribePush(pushSubscription)

      setSubscription(pushSubscription)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    if (!subscription) return

    setBusy(true)
    setError(null)

    try {
      await subscription.unsubscribe()
      setSubscription(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable notifications.')
    } finally {
      setBusy(false)
    }
  }

  return {
    initializing,
    granted: permission === 'granted',
    permissionDenied: permission === 'denied',
    subscription,
    isSubscribed: subscription !== null,
    busy,
    error,
    subscribe,
    unsubscribe,
  }
}
