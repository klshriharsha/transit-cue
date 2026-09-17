import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import { CommuteConfigLimitError, commuteConfigStore, type CommuteConfigRow } from '@/integrations/supabase/commuteConfigStore'
import { subscriptionStore } from '@/integrations/supabase/subscriptionStore'

const stationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

const configSchema = z.object({
  clientId: z.string().min(1),
  endpoint: z.url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
  origin: stationSchema,
  destination: stationSchema,
  pushTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'pushTime must be in HH:MM format'),
})

export function serializeConfig(commuteConfig: CommuteConfigRow) {
  return {
    id: commuteConfig.id,
    origin: { id: commuteConfig.originId, name: commuteConfig.originName },
    destination: { id: commuteConfig.destinationId, name: commuteConfig.destinationName },
    pushTime: commuteConfig.pushTime,
  }
}

async function handlePost(request: NextRequest) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }

  const result = configSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: 'A valid commute configuration is required.' }, { status: 400 })
  }

  const { clientId, endpoint, keys, origin, destination, pushTime } = result.data
  const subscription = await subscriptionStore.upsert(clientId, { endpoint, keys })

  try {
    const commuteConfig = await commuteConfigStore.create(subscription.id, {
      originId: origin.id,
      originName: origin.name,
      destinationId: destination.id,
      destinationName: destination.name,
      pushTime,
    })

    return NextResponse.json(serializeConfig(commuteConfig), { status: 201 })
  } catch (error) {
    if (error instanceof CommuteConfigLimitError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    throw error
  }
}

async function handleGet(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get('endpoint')

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint query parameter is required.' }, { status: 400 })
  }

  const commuteConfigs = await commuteConfigStore.listBySubscriptionEndpoint(endpoint)

  return NextResponse.json({ configs: commuteConfigs.map(serializeConfig) })
}

export const POST = withErrorHandling(handlePost)
export const GET = withErrorHandling(handleGet)
