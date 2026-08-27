import type { Alternative } from 'hafas-client'
import { hafasClient } from '@/integrations/hafas/client'

export type UpcomingDeparture = {
  line: string
  when: string
  delayMinutes: number
}

const MAX_RESULTS = 3

function hasNotDeparted(departure: Alternative): departure is Alternative & { when: string } {
  return Boolean(departure.when) && new Date(departure.when as string).getTime() > Date.now()
}

export async function getNextDepartures(stationId: string, directionId?: string): Promise<UpcomingDeparture[]> {
  const { departures } = await hafasClient.departures(stationId, {
    direction: directionId,
  })

  return departures
    .filter(hasNotDeparted)
    .slice(0, MAX_RESULTS)
    .map((departure) => ({
      line: departure.line?.name ?? 'Unknown line',
      when: departure.when,
      delayMinutes: departure.delay != null ? Math.round(departure.delay / 60) : 0,
    }))
}
