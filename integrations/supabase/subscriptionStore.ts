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

export const subscriptionStore = {
  async upsert(subscription: StoredSubscription): Promise<SubscriptionRow> {
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert(
        { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        { onConflict: 'endpoint' },
      )
      .select()
      .single()

    if (error) throw new Error(`Failed to save subscription: ${error.message}`)

    return data as SubscriptionRow
  },

  async all(): Promise<SubscriptionRow[]> {
    const { data, error } = await supabase.from('subscriptions').select('*')

    if (error) throw new Error(`Failed to load subscriptions: ${error.message}`)

    return data as SubscriptionRow[]
  },
}
