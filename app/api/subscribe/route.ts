import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import { subscriptionStore } from '@/integrations/supabase/subscriptionStore'
import { MAX_PUSH_ENDPOINT_LENGTH, MAX_PUSH_KEY_LENGTH } from '@/lib/limits'

const bodySchema = z.object({
  clientId: z.uuid(),
  subscription: z.object({
    endpoint: z.url().max(MAX_PUSH_ENDPOINT_LENGTH),
    keys: z.object({
      auth: z.string().min(1).max(MAX_PUSH_KEY_LENGTH),
      p256dh: z.string().min(1).max(MAX_PUSH_KEY_LENGTH),
    }),
  }),
})

async function handler(request: NextRequest) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }

  const result = bodySchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: 'A valid push subscription is required.' }, { status: 400 })
  }

  await subscriptionStore.upsert(result.data.clientId, result.data.subscription)

  return NextResponse.json({ subscribed: true }, { status: 201 })
}

export const POST = withErrorHandling(handler)
