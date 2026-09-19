import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import { buildNotificationPreview } from '@/lib/reminders'

const querySchema = z.object({
  originId: z.string().min(1),
  originName: z.string().min(1),
  destinationId: z.string().min(1),
  destinationName: z.string().min(1),
})

async function handler(request: NextRequest) {
  const result = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))

  if (!result.success) {
    return NextResponse.json({ error: 'origin and destination stops are required.' }, { status: 400 })
  }

  const { originId, originName, destinationId, destinationName } = result.data

  const preview = await buildNotificationPreview({ id: originId, name: originName }, { id: destinationId, name: destinationName })

  return NextResponse.json({ preview })
}

export const GET = withErrorHandling(handler)
