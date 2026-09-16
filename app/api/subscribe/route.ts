import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import { subscriptionStore } from '@/integrations/supabase/subscriptionStore'

const bodySchema = z.object({
  clientId: z.string().min(1),
  subscription: z.object({
    endpoint: z.url(),
    keys: z.object({
      auth: z.string().min(1),
      p256dh: z.string().min(1),
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
