import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { withErrorHandling } from '@/lib/api-handler'
import { config } from '@/lib/config'
import { logger } from '@/lib/logger'
import { runDueReminders } from '@/lib/reminders'

export const maxDuration = 30

function isAuthorized(authorizationHeader: string | null): boolean {
  if (!authorizationHeader?.startsWith('Bearer ')) return false

  const provided = Buffer.from(authorizationHeader.slice('Bearer '.length))
  const expected = Buffer.from(config.CRON_SECRET)

  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

async function handler(request: NextRequest) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    logger.warn('Rejected unauthorized cron trigger')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runDueReminders()

  return NextResponse.json(result)
}

// The external cron trigger (cron-job.org) can be configured for either method; both are
// wired to the same handler so this isn't sensitive to how it's set up.
export const GET = withErrorHandling(handler)
export const POST = withErrorHandling(handler)
