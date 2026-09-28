import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import type { Station } from '@/lib/types'
import { hafasClient } from '@/integrations/hafas/client'
import { MAX_STATION_QUERY_LENGTH } from '@/lib/limits'

// Stop names and ids change rarely, so let the CDN answer repeated searches for a day.
const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=86400'

const querySchema = z.object({
  query: z.string().trim().min(1).max(MAX_STATION_QUERY_LENGTH),
})

async function handler(request: NextRequest) {
  const result = querySchema.safeParse({ query: request.nextUrl.searchParams.get('query') })

  if (!result.success) {
    return NextResponse.json({ error: 'A non-empty query parameter is required.' }, { status: 400 })
  }

  const locations = await hafasClient.locations(result.data.query, { results: 5, stops: true })

  const stations: Station[] = locations
    .filter((location) => Boolean(location.id) && Boolean(location.name))
    .map((location) => ({ id: location.id as string, name: location.name as string }))

  return NextResponse.json({ stations }, { headers: { 'Cache-Control': CACHE_CONTROL } })
}

export const GET = withErrorHandling(handler)
