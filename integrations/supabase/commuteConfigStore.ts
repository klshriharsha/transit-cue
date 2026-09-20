import { supabase } from '@/integrations/supabase/client'
import type { StoredSubscription } from '@/lib/types'

export const MAX_COMMUTE_CONFIGS_PER_SUBSCRIPTION = 5

// The `enforce_commute_config_limit` trigger raises this errcode when a subscription already
// holds MAX_COMMUTE_CONFIGS_PER_SUBSCRIPTION rows; see the migration for the check itself.
const LIMIT_REACHED_ERRCODE = '23514'

export class CommuteConfigLimitError extends Error {
  constructor() {
    super(`A subscription cannot have more than ${MAX_COMMUTE_CONFIGS_PER_SUBSCRIPTION} commute configs.`)
    this.name = 'CommuteConfigLimitError'
  }
}

export type CommuteConfigInput = {
  originId: string
  originName: string
  destinationId: string
  destinationName: string
  pushTime: string
  /** Days this alert repeats on, as `Date.getDay()` values (0 = Sunday .. 6 = Saturday). */
  repeatDays: number[]
}

export type CommuteConfigRow = {
  id: string
  originId: string
  originName: string
  destinationId: string
  destinationName: string
  pushTime: string
  repeatDays: number[]
  paused: boolean
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
  repeat_days: number
  paused: boolean
}

type RawConfigRowWithSubscription = RawConfigRow & {
  subscription: { id: string; endpoint: string; p256dh: string; auth: string }
}

type RawDueConfigRow = RawConfigRow & {
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
}

const CONFIG_COLUMNS = 'id, origin_id, origin_name, destination_id, destination_name, push_time, repeat_days, paused'
const CONFIG_WITH_SUBSCRIPTION_COLUMNS = `${CONFIG_COLUMNS}, subscription:subscriptions(id, endpoint, p256dh, auth)`

/** Packs `Date.getDay()` values into the bitmask stored in `repeat_days` (bit i == day i). */
function daysToMask(days: number[]): number {
  return days.reduce((mask, day) => mask | (1 << day), 0)
}

/** Unpacks the `repeat_days` bitmask back into `Date.getDay()` values, ascending. */
function maskToDays(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((day) => (mask & (1 << day)) !== 0)
}

function mapConfigRow(row: RawConfigRow): CommuteConfigRow {
  return {
    id: row.id,
    originId: row.origin_id,
    originName: row.origin_name,
    destinationId: row.destination_id,
    destinationName: row.destination_name,
    pushTime: row.push_time,
    repeatDays: maskToDays(row.repeat_days),
    paused: row.paused,
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

function mapDueConfigRow(row: RawDueConfigRow): CommuteConfigWithSubscription {
  return {
    ...mapConfigRow(row),
    subscription: {
      id: row.subscription_id,
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    },
  }
}

export const commuteConfigStore = {
  async create(subscriptionId: string, data: CommuteConfigInput): Promise<CommuteConfigRow> {
    const { data: row, error } = await supabase
      .from('commute_configs')
      .insert({
        subscription_id: subscriptionId,
        origin_id: data.originId,
        origin_name: data.originName,
        destination_id: data.destinationId,
        destination_name: data.destinationName,
        push_time: data.pushTime,
        repeat_days: daysToMask(data.repeatDays),
      })
      .select(CONFIG_COLUMNS)
      .single()

    if (error) {
      if (error.code === LIMIT_REACHED_ERRCODE) throw new CommuteConfigLimitError()
      throw new Error(`Failed to save commute config: ${error.message}`)
    }

    return mapConfigRow(row as RawConfigRow)
  },

  /** Deletes a commute config, scoped to `subscriptionId` so one subscription can't delete another's row. */
  async remove(id: string, subscriptionId: string): Promise<void> {
    const { error } = await supabase.from('commute_configs').delete().eq('id', id).eq('subscription_id', subscriptionId)

    if (error) throw new Error(`Failed to delete commute config: ${error.message}`)
  },

  /** Pauses/resumes a commute config, scoped to `subscriptionId` so one subscription can't mutate another's row. */
  async setPaused(id: string, subscriptionId: string, paused: boolean): Promise<CommuteConfigRow> {
    const { data: row, error } = await supabase
      .from('commute_configs')
      .update({ paused })
      .eq('id', id)
      .eq('subscription_id', subscriptionId)
      .select(CONFIG_COLUMNS)
      .single()

    if (error) throw new Error(`Failed to update commute config: ${error.message}`)

    return mapConfigRow(row as RawConfigRow)
  },

  async listBySubscriptionEndpoint(endpoint: string): Promise<CommuteConfigRow[]> {
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (subscriptionError) throw new Error(`Failed to load subscription: ${subscriptionError.message}`)
    if (!subscription) return []

    const { data, error } = await supabase.from('commute_configs').select(CONFIG_COLUMNS).eq('subscription_id', subscription.id)

    if (error) throw new Error(`Failed to load commute configs: ${error.message}`)

    return (data as RawConfigRow[]).map(mapConfigRow)
  },

  /**
   * Configs due right now: matching `pushTime` whose `repeat_days` bitmask includes
   * `dayOfWeek` (a `Date.getDay()` value). Delegates the bitmask check to the
   * `due_commute_configs` DB function since PostgREST's filter operators have no bitwise AND.
   */
  async dueAt(pushTime: string, dayOfWeek: number): Promise<CommuteConfigWithSubscription[]> {
    const { data, error } = await supabase.rpc('due_commute_configs', {
      p_push_time: pushTime,
      p_day_bit: 1 << dayOfWeek,
    })

    if (error) throw new Error(`Failed to load due commute configs: ${error.message}`)

    return (data as RawDueConfigRow[]).map(mapDueConfigRow)
  },

  async all(): Promise<CommuteConfigWithSubscription[]> {
    const { data, error } = await supabase.from('commute_configs').select(CONFIG_WITH_SUBSCRIPTION_COLUMNS)

    if (error) throw new Error(`Failed to load commute configs: ${error.message}`)

    return (data as unknown as RawConfigRowWithSubscription[]).map(mapConfigRowWithSubscription)
  },
}
