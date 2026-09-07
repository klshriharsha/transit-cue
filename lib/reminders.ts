import { config } from '@/lib/config'
import { logger } from '@/lib/logger'
import { getNextDepartures, type UpcomingDeparture } from '@/integrations/hafas/departures'
import { commuteConfigStore, type CommuteConfigWithSubscription } from '@/integrations/supabase/commuteConfigStore'
import { subscriptionStore } from '@/integrations/supabase/subscriptionStore'
import { webpush } from '@/integrations/webpush'

function currentTime(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: config.TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

function minutesUntil(when: string): number {
  return Math.max(0, Math.round((new Date(when).getTime() - Date.now()) / 60_000))
}

function formatDeparturesMessage(
  originName: string,
  destinationName: string,
  departures: UpcomingDeparture[],
): string | null {
  const [next, ...rest] = departures

  if (!next) return null

  const status = next.delayMinutes > 0 ? `delayed ${next.delayMinutes} min` : 'on time'
  let message = `${next.line} from ${originName} to ${destinationName} departs in ${minutesUntil(next.when)} mins (${status}).`

  if (rest[0]) {
    message += ` Next one in ${minutesUntil(rest[0].when)} mins.`
  }

  return message
}

async function sendReminderForConfig(commuteConfig: CommuteConfigWithSubscription): Promise<boolean> {
  const departures = await getNextDepartures(commuteConfig.originId, commuteConfig.destinationId)
  const message = formatDeparturesMessage(commuteConfig.originName, commuteConfig.destinationName, departures)

  if (!message) {
    logger.info({ commuteConfigId: commuteConfig.id }, 'No upcoming departures to notify about')
    return false
  }

  const payload = JSON.stringify({
    title: 'TransitCue',
    options: {
      body: message,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: 'transitcue-reminder',
    },
  })

  try {
    await webpush.sendNotification(commuteConfig.subscription, payload)
    return true
  } catch (error) {
    // 404 Not Found / 410 Gone: the push service has permanently dropped this endpoint (the
    // user cleared browser data, uninstalled the PWA, or it simply expired). Delete the
    // subscription row so it stops being retried every minute; the FK cascade takes the
    // orphaned commute config with it.
    const statusCode = (error as { statusCode?: number }).statusCode

    if (statusCode === 404 || statusCode === 410) {
      logger.info(
        { commuteConfigId: commuteConfig.id, subscriptionId: commuteConfig.subscription.id },
        'Pruning expired push subscription',
      )
      await subscriptionStore.delete(commuteConfig.subscription.id).catch((deleteError: unknown) => {
        logger.warn({ err: deleteError, commuteConfigId: commuteConfig.id }, 'Failed to prune expired push subscription')
      })
      return false
    }

    logger.warn({ err: error, commuteConfigId: commuteConfig.id }, 'Failed to send transit reminder push')
    return false
  }
}

export type TransitReminderResult = {
  attempted: number
  sent: number
  failed: number
}

/** Sends reminders for every commute config whose pushTime matches the current HH:MM in config.TIMEZONE. */
export async function runDueReminders(): Promise<TransitReminderResult> {
  const commuteConfigs = await commuteConfigStore.dueAt(currentTime())
  const results = await Promise.allSettled(commuteConfigs.map((commuteConfig) => sendReminderForConfig(commuteConfig)))
  const sent = results.filter((result) => result.status === 'fulfilled' && result.value).length

  return { attempted: commuteConfigs.length, sent, failed: commuteConfigs.length - sent }
}
