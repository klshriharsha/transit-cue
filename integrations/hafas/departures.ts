import type { Journey, Leg } from 'hafas-client'
import { hafasClient } from '@/integrations/hafas/client'

export type UpcomingDeparture = {
  line: string
  when: string
  delayMinutes: number
}

const MAX_RESULTS = 3

/**
 * The leg the rider actually boards. journeys() prepends a walking leg to/from the stop, so the
 * first transit leg (not legs[0]) is the one whose line/departure we want to surface.
 */
function firstTransitLeg(journey: Journey): (Leg & { line: NonNullable<Leg['line']>; departure: string }) | undefined {
  const leg = journey.legs.find((leg) => !leg.walking && leg.line && leg.departure)
  return leg as (Leg & { line: NonNullable<Leg['line']>; departure: string }) | undefined
}

function hasNotDeparted(leg: { departure: string }): boolean {
  return new Date(leg.departure).getTime() > Date.now()
}

/**
 * journeys() treats `results` as a hint, not a cap, and routinely returns several journeys for
 * the same physical trip (differing only in, e.g., the walking leg at the far end). Dedupe by
 * tripId so callers see distinct departures rather than the same bus listed twice.
 */
function dedupeByTrip<T extends { tripId?: string }>(legs: T[]): T[] {
  const seenTripIds = new Set<string>()
  return legs.filter((leg) => {
    if (!leg.tripId) return true
    if (seenTripIds.has(leg.tripId)) return false
    seenTripIds.add(leg.tripId)
    return true
  })
}

export async function getNextDepartures(originId: string, destinationId: string): Promise<UpcomingDeparture[]> {
  // `results` is a hint, not a cap, and roughly half of what comes back is a duplicate of
  // another journey's trip (differing only in the walking leg). Over-request so that after
  // dedupeByTrip + hasNotDeparted filtering there are still MAX_RESULTS left.
  const { journeys = [] } = await hafasClient.journeys(originId, destinationId, {
    results: MAX_RESULTS * 2,
    stopovers: false,
    // Without this, HAFAS may route via a walk to a different nearby stop before boarding,
    // producing a "departure" the rider can't actually catch from the origin they selected.
    startWithWalking: false,
  })

  const boardingLegs = journeys.map(firstTransitLeg).filter((leg) => leg !== undefined)
  const upcoming = dedupeByTrip(boardingLegs).filter(hasNotDeparted)

  upcoming.sort((a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime())

  return upcoming.slice(0, MAX_RESULTS).map((leg) => ({
    line: leg.line.name ?? 'Unknown line',
    when: leg.departure,
    delayMinutes: leg.departureDelay != null ? Math.round(leg.departureDelay / 60) : 0,
  }))
}
