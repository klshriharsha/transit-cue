import { supabase } from '@/integrations/supabase/client'
import type { StoredSubscription } from '@/lib/types'

export type SubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export function toStoredSubscription(record: { endpoint: string; p256dh: string; auth: string }): StoredSubscription {
  return { endpoint: record.endpoint, keys: { p256dh: record.p256dh, auth: record.auth } }
}

const ROW_COLUMNS = 'id, endpoint, p256dh, auth'

export const subscriptionStore = {
  /**
   * Persist a browser's current push subscription, keyed by its stable `clientId` rather than
   * the (rotating) endpoint, so the same row — and any `commute_configs` linked to it — is
   * reused when the user toggles notifications off and back on.
   *
   * Resolution order:
   *  1. Row already owned by this `clientId` → update its endpoint + keys in place.
   *  2. No row for this `clientId`, but a row already holds this endpoint (localStorage was
   *     cleared while the browser's push subscription survived) → adopt it: stamp our
   *     `clientId` onto it and refresh its keys.
   *  3. Otherwise → insert a new row.
   */
  async upsert(clientId: string, subscription: StoredSubscription): Promise<SubscriptionRow> {
    const { endpoint, keys } = subscription

    const mine = await selectMaybe('client_id', clientId)

    if (mine) {
      // A stale row may still hold this freshly-issued endpoint (unique column). It belonged to
      // an earlier identity of this browser; drop it so the update below doesn't collide.
      await deleteWhere('endpoint', endpoint, mine.id)
      return updateRow(mine.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth })
    }

    const byEndpoint = await selectMaybe('endpoint', endpoint)

    if (byEndpoint) {
      return updateRow(byEndpoint.id, { client_id: clientId, p256dh: keys.p256dh, auth: keys.auth })
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({ client_id: clientId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .select(ROW_COLUMNS)
      .single()

    if (error) throw new Error(`Failed to save subscription: ${error.message}`)

    return data as SubscriptionRow
  },

  async findByClientId(clientId: string): Promise<{ id: string } | null> {
    return selectMaybe('client_id', clientId)
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)

    if (error) throw new Error(`Failed to delete subscription: ${error.message}`)
  },

  async all(): Promise<SubscriptionRow[]> {
    const { data, error } = await supabase.from('subscriptions').select(ROW_COLUMNS)

    if (error) throw new Error(`Failed to load subscriptions: ${error.message}`)

    return data as SubscriptionRow[]
  },
}

async function selectMaybe(column: 'client_id' | 'endpoint', value: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase.from('subscriptions').select('id').eq(column, value).maybeSingle()

  if (error) throw new Error(`Failed to load subscription: ${error.message}`)

  return data
}

async function deleteWhere(column: 'endpoint', value: string, exceptId: string): Promise<void> {
  const { error } = await supabase.from('subscriptions').delete().eq(column, value).neq('id', exceptId)

  if (error) throw new Error(`Failed to reconcile subscription: ${error.message}`)
}

async function updateRow(
  id: string,
  patch: { endpoint?: string; client_id?: string; p256dh: string; auth: string },
): Promise<SubscriptionRow> {
  const { data, error } = await supabase.from('subscriptions').update(patch).eq('id', id).select(ROW_COLUMNS).single()

  if (error) throw new Error(`Failed to save subscription: ${error.message}`)

  return data as SubscriptionRow
}
