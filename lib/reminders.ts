import { config } from '@/lib/config'
import { logger } from '@/lib/logger'
import type { Station } from '@/lib/types'
import { getNextDepartures, type UpcomingDeparture } from '@/integrations/hafas/departures'
import { commuteConfigStore, type DueWindow } from '@/integrations/supabase/commuteConfigStore'
import { subscriptionStore } from '@/integrations/supabase/subscriptionStore'
import { windowRunStore } from '@/integrations/supabase/windowRunStore'
import { webpush } from '@/integrations/webpush'
import { clockToMinutes, windowEnd } from '@/lib/format'

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: config.TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// en-CA formats dates as YYYY-MM-DD, which is what the DB `date` column expects.
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: config.TIMEZONE,
  weekday: 'short',
})

// Socket timeout for each push-service request, so a slow or unresponsive endpoint can't hold the
// cron run open until maxDuration.
const PUSH_TIMEOUT_MS = 5000

// How long the push service may hold the closing "not live" push. It only matters while the live
// notification it replaces could still be on screen.
const ENDED_PUSH_TTL_SECONDS = 5 * 60

// Floor for the TTL of live updates, so even the last-minute update has time to be delivered.
const MIN_LIVE_PUSH_TTL_SECONDS = 60

const NO_DEPARTURES_TEXT = 'No upcoming departures found.'

// Matches the `repeat_days` bitmask convention: 0 = Sunday .. 6 = Saturday.
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

type ZonedNow = {
  /** Minutes after midnight. */
  minute: number
  /** `Date.getDay()` value: 0 = Sunday .. 6 = Saturday, matching the `repeat_days` bitmask. */
  day: number
  /** YYYY-MM-DD */
  date: string
}

/** The current minute, weekday and date in config.TIMEZONE, not the server's local zone. */
function zonedNow(now = new Date()): ZonedNow {
  return {
    minute: clockToMinutes(clockFormatter.format(now)),
    day: WEEKDAY_INDEX[weekdayFormatter.format(now)],
    date: dateFormatter.format(now),
  }
}

function formatDepartureLine(departure: UpcomingDeparture): string {
  const status = departure.delayMinutes > 0 ? `+${departure.delayMinutes} min` : 'on time'
  return `${departure.line} · ${clockFormatter.format(new Date(departure.when))} · ${status}`
}

function formatDeparturesMessage(departures: UpcomingDeparture[]): string | null {
  if (departures.length === 0) return null

  return departures.map(formatDepartureLine).join('\n')
}

export type NotificationPreview = {
  title: string
  body: string
}

/**
 * Builds the exact title/body a push notification would carry for this origin/destination right
 * now. Shared by the cron reminder sender and the onboarding preview API so the preview never
 * drifts from what actually gets sent.
 */
export async function buildNotificationPreview(origin: Station, destination: Station): Promise<NotificationPreview | null> {
  const departures = await getNextDepartures(origin.id, destination.id)
  const body = formatDeparturesMessage(departures)

  if (!body) return null

  return { title: `${origin.name} → ${destination.name}`, body }
}

type PushContent = {
  title: string
  body: string
  /** Live notifications offer "Stop for today", and dismissing them stops further updates. */
  live: boolean
  /** Updates replace the notification quietly; only the first push of a window should alert. */
  silent: boolean
}

function routeTitle(window: DueWindow): string {
  return `${window.originName} → ${window.destinationName}`
}

/**
 * Sends one push for `window`, replacing whatever notification this alert currently shows (same
 * `tag`). Returns false if the push service rejected it; prunes the subscription on 404/410.
 */
async function sendWindowPush(window: DueWindow, content: PushContent, ttlSeconds: number): Promise<boolean> {
  const payload = JSON.stringify({
    title: content.title,
    options: {
      body: content.body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: `transitcue-reminder-${window.id}`,
      renotify: false,
      silent: content.silent,
      // Desktop browsers otherwise tuck the notification away after a few seconds, which defeats
      // a live board. Mobile platforms ignore this.
      requireInteraction: content.live,
      actions: content.live ? [{ action: 'stop', title: 'Stop for today' }] : [],
      // Read by the service worker: `sentAt` lets it drop an update that arrives after a newer
      // one; `configId`/`windowDate` identify the window to stop on dismissal.
      data: { configId: window.id, windowDate: window.windowDate, sentAt: Date.now(), live: content.live },
    },
  })

  try {
    // web-push defaults to `normal` urgency and a 4-week TTL. Push services hold normal-urgency
    // messages while the device is idle (Android Doze, APNs power-considerate priority) and
    // deliver them in a batch later, so alerts arrived hours late. `high` asks for immediate
    // delivery, and the short TTL drops a push outright rather than delivering it after it's moot.
    await webpush.sendNotification(window.subscription, payload, {
      timeout: PUSH_TIMEOUT_MS,
      urgency: 'high',
      TTL: ttlSeconds,
    })
    return true
  } catch (error) {
    // 404 Not Found / 410 Gone: the push service has permanently dropped this endpoint (the
    // user cleared browser data, uninstalled the PWA, or it simply expired). Delete the
    // subscription row so it stops being retried every minute; the FK cascade takes the
    // orphaned commute config with it.
    const statusCode = (error as { statusCode?: number }).statusCode

    if (statusCode === 404 || statusCode === 410) {
      logger.info({ commuteConfigId: window.id, subscriptionId: window.subscription.id }, 'Pruning expired push subscription')
      await subscriptionStore.delete(window.subscription.id).catch((deleteError: unknown) => {
        logger.warn({ err: deleteError, commuteConfigId: window.id }, 'Failed to prune expired push subscription')
      })
      return false
    }

    logger.warn({ err: error, commuteConfigId: window.id }, 'Failed to send transit push')
    return false
  }
}

type WindowOutcome = 'sent' | 'unchanged' | 'failed'

/** Minutes left in an open window. Handles windows that run past midnight. */
function minutesRemaining(window: DueWindow, now: ZonedNow): number {
  const elapsed = (((now.minute - clockToMinutes(window.windowStart)) % 1440) + 1440) % 1440
  return window.windowMinutes - elapsed
}

/** Pushes the current board for an open window, but only if it differs from what was last pushed. */
async function pushLiveBoard(window: DueWindow, departures: Promise<UpcomingDeparture[]>, now: ZonedNow): Promise<WindowOutcome> {
  const lines = formatDeparturesMessage(await departures) ?? NO_DEPARTURES_TEXT

  if (lines === window.lastBody) return 'unchanged'

  const sent = await sendWindowPush(
    window,
    {
      title: routeTitle(window),
      body: `${lines}\nLive until ${windowEnd(window.windowStart, window.windowMinutes)}`,
      live: true,
      silent: window.lastBody !== null,
    },
    // A live update is useful until the window closes; the service worker discards any that
    // arrive after a newer one.
    Math.max(MIN_LIVE_PUSH_TTL_SECONDS, minutesRemaining(window, now) * 60),
  )

  if (!sent) return 'failed'

  await windowRunStore.recordSent(window.id, window.windowDate, lines)
  return 'sent'
}

/** Replaces the live notification of a window that just closed with a clearly-stale version. */
async function pushWindowEnded(window: DueWindow): Promise<WindowOutcome> {
  const sent = await sendWindowPush(
    window,
    {
      title: routeTitle(window),
      body: `Not live since ${windowEnd(window.windowStart, window.windowMinutes)} · times may have changed\n${window.lastBody ?? ''}`.trim(),
      live: false,
      silent: true,
    },
    ENDED_PUSH_TTL_SECONDS,
  )

  // On failure, leave the run unfinalized so the next tick retries (the DB only offers it for
  // a few minutes after the window closes).
  if (!sent) return 'failed'

  await windowRunStore.finalize(window.id, window.windowDate)
  return 'sent'
}

export type WindowRunResult = {
  /** Windows that needed attention this minute (open, or just closed). */
  due: number
  sent: number
  /** Open windows whose board hadn't changed since the last push, so nothing was sent. */
  unchanged: number
  failed: number
}

/**
 * Runs one cron tick: for every open window, pushes the departure board if it changed since the
 * last push; for every window that just closed, marks its notification as no longer live.
 */
export async function runDueWindows(): Promise<WindowRunResult> {
  const now = zonedNow()
  const windows = await commuteConfigStore.dueWindows(now.minute, now.day, now.date)

  // Several alerts (often from different riders) can share a route; look each route up once.
  const departuresByRoute = new Map<string, Promise<UpcomingDeparture[]>>()
  const departuresFor = (window: DueWindow) => {
    const key = `${window.originId}::${window.destinationId}`
    let departures = departuresByRoute.get(key)
    if (!departures) {
      departures = getNextDepartures(window.originId, window.destinationId)
      departuresByRoute.set(key, departures)
    }
    return departures
  }

  const results = await Promise.allSettled(
    windows.map((window) => (window.phase === 'live' ? pushLiveBoard(window, departuresFor(window), now) : pushWindowEnded(window))),
  )

  const outcomes = results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value
    logger.warn({ err: result.reason, commuteConfigId: windows[i].id }, 'Failed to process commute window')
    return 'failed'
  })

  return {
    due: windows.length,
    sent: outcomes.filter((outcome) => outcome === 'sent').length,
    unchanged: outcomes.filter((outcome) => outcome === 'unchanged').length,
    failed: outcomes.filter((outcome) => outcome === 'failed').length,
  }
}
