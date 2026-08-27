'use client'

import { useEffect, useState } from 'react'

export type Station = {
  id: string
  name: string
}

export type CommuteConfig = {
  origin: Station
  destination: Station
  pushTime: string
}

type SaveInput = {
  endpoint: string
  keys: { auth: string; p256dh: string }
  origin: Station
  destination: Station
  pushTime: string
}

async function fetchCommuteConfig(endpoint: string): Promise<CommuteConfig | null> {
  const response = await fetch(`/api/config?endpoint=${encodeURIComponent(endpoint)}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('The API could not load your commute preferences.')
  }

  return response.json() as Promise<CommuteConfig>
}

async function saveCommuteConfig(payload: SaveInput): Promise<CommuteConfig> {
  const response = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('The API could not save your commute preferences.')
  }

  return response.json() as Promise<CommuteConfig>
}

export function useCommuteConfig(subscription: PushSubscription | null) {
  const [savedConfig, setSavedConfig] = useState<CommuteConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const task = subscription ? fetchCommuteConfig(subscription.endpoint) : Promise.resolve(null)

    Promise.resolve().then(() => setIsLoading(true))

    task
      .then(setSavedConfig)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load saved preferences.')
      })
      .finally(() => setIsLoading(false))
  }, [subscription])

  const save = async (
    origin: Station,
    destination: Station,
    pushTime: string,
  ): Promise<{ config: CommuteConfig; error: null } | { config: null; error: string }> => {
    if (!subscription) {
      const message = 'Enable notifications before saving preferences.'
      setError(message)
      return { config: null, error: message }
    }

    const keys = subscription.toJSON().keys

    if (!keys) {
      const message = 'This push subscription is missing encryption keys.'
      setError(message)
      return { config: null, error: message }
    }

    setIsSaving(true)
    setError(null)

    try {
      const config = await saveCommuteConfig({
        endpoint: subscription.endpoint,
        keys: { auth: keys.auth, p256dh: keys.p256dh },
        origin,
        destination,
        pushTime,
      })

      setSavedConfig(config)
      return { config, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save preferences.'
      setError(message)
      return { config: null, error: message }
    } finally {
      setIsSaving(false)
    }
  }

  return { savedConfig, isLoading, isSaving, error, save }
}
