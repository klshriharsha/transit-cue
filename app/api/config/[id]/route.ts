import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import { commuteConfigStore } from '@/integrations/supabase/commuteConfigStore'
import { subscriptionStore } from '@/integrations/supabase/subscriptionStore'
import { serializeConfig } from '@/app/api/config/route'

const idSchema = z.uuid()

const deleteSchema = z.object({
  clientId: z.uuid(),
})

const patchSchema = z.object({
  clientId: z.uuid(),
  paused: z.boolean(),
})

async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'A valid commute config id is required.' }, { status: 400 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }

  const result = deleteSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: 'clientId is required.' }, { status: 400 })
  }

  const subscription = await subscriptionStore.findByClientId(result.data.clientId)

  if (!subscription) {
    return NextResponse.json({ error: 'No subscription found for this client.' }, { status: 404 })
  }

  await commuteConfigStore.remove(id, subscription.id)

  return NextResponse.json({ deleted: true })
}

async function handlePatch(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'A valid commute config id is required.' }, { status: 400 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }

  const result = patchSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: 'clientId and paused are required.' }, { status: 400 })
  }

  const subscription = await subscriptionStore.findByClientId(result.data.clientId)

  if (!subscription) {
    return NextResponse.json({ error: 'No subscription found for this client.' }, { status: 404 })
  }

  const commuteConfig = await commuteConfigStore.setPaused(id, subscription.id, result.data.paused)

  return NextResponse.json(serializeConfig(commuteConfig))
}

export const DELETE = withErrorHandling(handleDelete)
export const PATCH = withErrorHandling(handlePatch)
