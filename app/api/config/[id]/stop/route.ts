import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/api-handler'
import { MAX_PUSH_ENDPOINT_LENGTH } from '@/lib/limits'
import { commuteConfigStore } from '@/integrations/supabase/commuteConfigStore'
import { windowRunStore } from '@/integrations/supabase/windowRunStore'

const idSchema = z.uuid()

// Called by the service worker, which can't read the clientId in localStorage. It proves
// ownership with the push endpoint instead, the same credential `GET /api/config` accepts.
const stopSchema = z.object({
  endpoint: z.url().max(MAX_PUSH_ENDPOINT_LENGTH),
  windowDate: z.iso.date(),
})

/** Stops live updates for one day's window, after the rider dismissed it or tapped "Stop for today". */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const result = stopSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({ error: 'endpoint and windowDate are required.' }, { status: 400 })
  }

  const ownerEndpoint = await commuteConfigStore.endpointFor(id)

  if (ownerEndpoint !== result.data.endpoint) {
    return NextResponse.json({ error: 'No such alert for this subscription.' }, { status: 404 })
  }

  await windowRunStore.stop(id, result.data.windowDate)

  return NextResponse.json({ stopped: true })
}

export const POST = withErrorHandling(handlePost)
