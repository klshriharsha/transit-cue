'use client'

import { useEffect, useState } from 'react'
import type { Station } from '@/lib/types'

export type NotificationPreview = {
  title: string
  body: string
}

export type NotificationPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; preview: NotificationPreview | null }
  | { status: 'error'; message: string }

async function fetchPreview(origin: Station, destination: Station): Promise<NotificationPreview | null> {
  const params = new URLSearchParams({
    originId: origin.id,
    originName: origin.name,
    destinationId: destination.id,
    destinationName: destination.name,
  })

  const response = await fetch(`/api/preview?${params}`)

  if (!response.ok) {
    throw new Error('The API could not load a notification preview.')
  }

  const data = (await response.json()) as { preview: NotificationPreview | null }
  return data.preview
}

/** Live "what will this look like" preview of the push a commute alert would send right now. */
export function useNotificationPreview(
  origin: Station | null,
  destination: Station | null,
): NotificationPreviewState & { refresh: () => void } {
  const requestKey = origin && destination ? `${origin.id}::${destination.id}` : null

  const [state, setState] = useState<NotificationPreviewState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)
  // Tracks which (stops, refresh click) this render's `state` reflects, so a change to
  // either can flip straight to "loading" during render instead of via a post-commit effect.
  const [tracked, setTracked] = useState<{ key: string | null; attempt: number }>({ key: null, attempt: 0 })

  if (requestKey !== tracked.key || attempt !== tracked.attempt) {
    setTracked({ key: requestKey, attempt })
    setState(requestKey ? { status: 'loading' } : { status: 'idle' })
  }

  useEffect(() => {
    if (!origin || !destination) return

    let cancelled = false

    fetchPreview(origin, destination)
      .then((preview) => {
        if (!cancelled) setState({ status: 'ready', preview })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load preview.' })
      })

    return () => {
      cancelled = true
    }
  }, [origin, destination, attempt])

  return { ...state, refresh: () => setAttempt((a) => a + 1) }
}
