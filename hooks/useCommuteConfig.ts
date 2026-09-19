'use client'

import { useEffect, useState } from 'react'
import { getClientId } from '@/lib/client-id'
import type { Station } from '@/lib/types'

export const MAX_COMMUTE_CONFIGS = 5

export type CommuteConfig = {
  id: string
  origin: Station
  destination: Station
  pushTime: string
  repeatDays: number[]
}

type SaveInput = {
  clientId: string
  endpoint: string
  keys: { auth: string; p256dh: string }
  origin: Station
  destination: Station
  pushTime: string
  repeatDays: number[]
}

async function fetchCommuteConfigs(endpoint: string): Promise<CommuteConfig[]> {
  const response = await fetch(`/api/config?endpoint=${encodeURIComponent(endpoint)}`)

  if (!response.ok) {
    throw new Error('The API could not load your commute preferences.')
  }

  const data = (await response.json()) as { configs: CommuteConfig[] }
  return data.configs
}

async function createCommuteConfig(payload: SaveInput): Promise<CommuteConfig> {
  const response = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'The API could not save your commute preferences.')
  }

  return response.json() as Promise<CommuteConfig>
}

async function deleteCommuteConfig(id: string, clientId: string): Promise<void> {
  const response = await fetch(`/api/config/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'The API could not delete this alert.')
  }
}

export function useCommuteConfig(subscription: PushSubscription | null) {
  const [savedConfigs, setSavedConfigs] = useState<CommuteConfig[]>([])
  // Starts true: the first load hasn't run yet, and the UI should treat that as
  // "loading" rather than "no alerts" so nothing flashes before the fetch settles.
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackedEndpoint, setTrackedEndpoint] = useState<string | null | undefined>(undefined)

  // Flip back to loading in the same render that delivers a new subscription, so
  // there's no intermediate frame showing stale (or empty) data as settled.
  const endpoint = subscription?.endpoint ?? null
  if (endpoint !== trackedEndpoint) {
    setTrackedEndpoint(endpoint)
    setIsLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    const task = subscription ? fetchCommuteConfigs(subscription.endpoint) : Promise.resolve([])

    task
      .then((configs) => {
        if (!cancelled) setSavedConfigs(configs)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load saved preferences.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [subscription])

  const add = async (
    origin: Station,
    destination: Station,
    pushTime: string,
    repeatDays: number[],
  ): Promise<{ config: CommuteConfig; error: null } | { config: null; error: string }> => {
    if (!subscription) {
      const message = 'Enable notifications before saving preferences.'
      setError(message)
      return { config: null, error: message }
    }

    if (savedConfigs.length >= MAX_COMMUTE_CONFIGS) {
      const message = `You can track up to ${MAX_COMMUTE_CONFIGS} commute alerts.`
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
      const config = await createCommuteConfig({
        clientId: getClientId(),
        endpoint: subscription.endpoint,
        keys: { auth: keys.auth, p256dh: keys.p256dh },
        origin,
        destination,
        pushTime,
        repeatDays,
      })

      setSavedConfigs((configs) => configs.concat(config))
      return { config, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save preferences.'
      setError(message)
      return { config: null, error: message }
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (id: string): Promise<{ error: null } | { error: string }> => {
    try {
      await deleteCommuteConfig(id, getClientId())
      setSavedConfigs((configs) => configs.filter((config) => config.id !== id))
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete this alert.'
      setError(message)
      return { error: message }
    }
  }

  return { savedConfigs, isLoading, isSaving, error, add, remove }
}
