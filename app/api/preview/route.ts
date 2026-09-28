import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import { MAX_STATION_ID_LENGTH, MAX_STATION_NAME_LENGTH } from '@/lib/limits'
import { buildNotificationPreview } from '@/lib/reminders'

// Departures shift minute to minute, so only cache briefly: long enough that repeated previews of
// the same route are served by the CDN instead of each one hitting VBB.
const CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=30'

const querySchema = z.object({
  originId: z.string().min(1).max(MAX_STATION_ID_LENGTH),
  originName: z.string().min(1).max(MAX_STATION_NAME_LENGTH),
  destinationId: z.string().min(1).max(MAX_STATION_ID_LENGTH),
  destinationName: z.string().min(1).max(MAX_STATION_NAME_LENGTH),
})

async function handler(request: NextRequest) {
  const result = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))

  if (!result.success) {
    return NextResponse.json({ error: 'origin and destination stops are required.' }, { status: 400 })
  }

  const { originId, originName, destinationId, destinationName } = result.data

  const preview = await buildNotificationPreview({ id: originId, name: originName }, { id: destinationId, name: destinationName })

  return NextResponse.json({ preview }, { headers: { 'Cache-Control': CACHE_CONTROL } })
}

export const GET = withErrorHandling(handler)
