import { supabase } from '@/integrations/supabase/client'
import type { StoredSubscription } from '@/lib/types'

export type CommuteConfigInput = {
  originId: string
  originName: string
  destinationId: string
  destinationName: string
  pushTime: string
}

export type CommuteConfigRow = {
  id: string
  originId: string
  originName: string
  destinationId: string
  destinationName: string
  pushTime: string
}

export type CommuteConfigWithSubscription = CommuteConfigRow & {
  subscription: StoredSubscription & { id: string }
}

type RawConfigRow = {
  id: string
  origin_id: string
  origin_name: string
  destination_id: string
  destination_name: string
  push_time: string
}

type RawConfigRowWithSubscription = RawConfigRow & {
  subscription: { id: string; endpoint: string; p256dh: string; auth: string }
}

const CONFIG_COLUMNS = 'id, origin_id, origin_name, destination_id, destination_name, push_time'
const CONFIG_WITH_SUBSCRIPTION_COLUMNS = `${CONFIG_COLUMNS}, subscription:subscriptions(id, endpoint, p256dh, auth)`

function mapConfigRow(row: RawConfigRow): CommuteConfigRow {
  return {
    id: row.id,
    originId: row.origin_id,
    originName: row.origin_name,
    destinationId: row.destination_id,
    destinationName: row.destination_name,
    pushTime: row.push_time,
  }
}

function mapConfigRowWithSubscription(row: RawConfigRowWithSubscription): CommuteConfigWithSubscription {
  return {
    ...mapConfigRow(row),
    subscription: {
      id: row.subscription.id,
      endpoint: row.subscription.endpoint,
      keys: { p256dh: row.subscription.p256dh, auth: row.subscription.auth },
    },
  }
}

export const commuteConfigStore = {
  async upsertForSubscription(subscriptionId: string, data: CommuteConfigInput): Promise<CommuteConfigRow> {
    const { data: row, error } = await supabase
      .from('commute_configs')
      .upsert(
        {
          subscription_id: subscriptionId,
          origin_id: data.originId,
          origin_name: data.originName,
          destination_id: data.destinationId,
          destination_name: data.destinationName,
          push_time: data.pushTime,
        },
        { onConflict: 'subscription_id' },
      )
      .select(CONFIG_COLUMNS)
      .single()

    if (error) throw new Error(`Failed to save commute config: ${error.message}`)

    return mapConfigRow(row as RawConfigRow)
  },

  async findBySubscriptionEndpoint(endpoint: string): Promise<CommuteConfigRow | null> {
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (subscriptionError) throw new Error(`Failed to load subscription: ${subscriptionError.message}`)
    if (!subscription) return null

    const { data, error } = await supabase
      .from('commute_configs')
      .select(CONFIG_COLUMNS)
      .eq('subscription_id', subscription.id)
      .maybeSingle()

    if (error) throw new Error(`Failed to load commute config: ${error.message}`)

    return data ? mapConfigRow(data as RawConfigRow) : null
  },

  async dueAt(pushTime: string): Promise<CommuteConfigWithSubscription[]> {
    const { data, error } = await supabase
      .from('commute_configs')
      .select(CONFIG_WITH_SUBSCRIPTION_COLUMNS)
      .eq('push_time', pushTime)

    if (error) throw new Error(`Failed to load due commute configs: ${error.message}`)

    return (data as unknown as RawConfigRowWithSubscription[]).map(mapConfigRowWithSubscription)
  },

  async all(): Promise<CommuteConfigWithSubscription[]> {
    const { data, error } = await supabase.from('commute_configs').select(CONFIG_WITH_SUBSCRIPTION_COLUMNS)

    if (error) throw new Error(`Failed to load commute configs: ${error.message}`)

    return (data as unknown as RawConfigRowWithSubscription[]).map(mapConfigRowWithSubscription)
  },
}
