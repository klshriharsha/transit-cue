import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import { commuteConfigStore } from '@/integrations/supabase/commuteConfigStore'
import { subscriptionStore } from '@/integrations/supabase/subscriptionStore'

const deleteSchema = z.object({
  clientId: z.string().min(1),
})

async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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

export const DELETE = withErrorHandling(handleDelete)
