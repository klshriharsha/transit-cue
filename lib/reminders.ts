import { config } from '@/lib/config'
import { logger } from '@/lib/logger'
import { getNextDepartures, type UpcomingDeparture } from '@/integrations/hafas/departures'
import { commuteConfigStore, type CommuteConfigWithSubscription } from '@/integrations/supabase/commuteConfigStore'
import { subscriptionStore } from '@/integrations/supabase/subscriptionStore'
import { webpush } from '@/integrations/webpush'

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: config.TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function currentTime(): string {
  return clockFormatter.format(new Date())
}

function formatDepartureLine(departure: UpcomingDeparture): string {
  const status = departure.delayMinutes > 0 ? `+${departure.delayMinutes} min` : 'on time'
  return `${departure.line} · ${clockFormatter.format(new Date(departure.when))} · ${status}`
}

function formatDeparturesMessage(departures: UpcomingDeparture[]): string | null {
  if (departures.length === 0) return null

  return departures.map(formatDepartureLine).join('\n')
}

async function sendReminderForConfig(commuteConfig: CommuteConfigWithSubscription): Promise<boolean> {
  const departures = await getNextDepartures(commuteConfig.originId, commuteConfig.destinationId)
  const message = formatDeparturesMessage(departures)

  if (!message) {
    logger.info({ commuteConfigId: commuteConfig.id }, 'No upcoming departures to notify about')
    return false
  }

  const payload = JSON.stringify({
    title: `${commuteConfig.originName} → ${commuteConfig.destinationName}`,
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
