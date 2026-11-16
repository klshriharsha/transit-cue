export const DAYS: [string, string][] = [
  ['S', 'Sunday'],
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
]
export const DEFAULT_DAYS = [1, 2, 3, 4, 5]

export function daysLabel(days: number[]): string {
  const key = [...days].sort().join(',')
  if (key === '0,1,2,3,4,5,6') return 'every day'
  if (key === '1,2,3,4,5') return 'weekdays'
  if (key === '0,6') return 'weekends'
  if (!days.length) return 'no days'
  return [...days]
    .sort()
    .map((i) => DAYS[i][1].slice(0, 3))
    .join(' ')
    .toLowerCase()
}

export function currentClock(): string {
  const now = new Date()
  return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
}

/** "HH:MM" → minutes after midnight. */
export function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

/** Minutes after midnight → zero-padded 24h "HH:MM" (wraps past midnight). */
export function minutesToClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  return String(Math.floor(wrapped / 60)).padStart(2, '0') + ':' + String(wrapped % 60).padStart(2, '0')
}

/** "HH:MM" at which a window opening at `windowStart` and lasting `windowMinutes` closes. */
export function windowEnd(windowStart: string, windowMinutes: number): string {
  return minutesToClock(clockToMinutes(windowStart) + windowMinutes)
}

export type WindowStatus = { kind: 'live'; until: Date } | { kind: 'upcoming'; at: Date } | { kind: 'unscheduled' }

/**
 * Where a window stands relative to `now` (device local time): open right now, or when it next
 * opens on one of `repeatDays`. A window that opened yesterday and runs past midnight counts as
 * live if yesterday was a repeat day.
 */
export function windowStatus(windowStart: string, windowMinutes: number, repeatDays: number[], now = new Date()): WindowStatus {
  const startMinutes = clockToMinutes(windowStart)
  if (Number.isNaN(startMinutes) || repeatDays.length === 0) return { kind: 'unscheduled' }

  for (let dayOffset = -1; dayOffset <= 7; dayOffset++) {
    const opens = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 0, startMinutes, 0, 0)
    if (!repeatDays.includes(opens.getDay())) continue
    const closes = new Date(opens.getTime() + windowMinutes * 60000)
    if (opens <= now && now < closes) return { kind: 'live', until: closes }
    if (opens > now) return { kind: 'upcoming', at: opens }
  }

  return { kind: 'unscheduled' }
}

export function windowStatusLabel(status: WindowStatus, formatClock: (value: Date) => string): string {
  if (status.kind === 'unscheduled') return 'not scheduled'
  if (status.kind === 'live') return 'live now · until ' + formatClock(status.until)
  const mins = Math.round((status.at.getTime() - Date.now()) / 60000)
  if (mins < 60) return 'live in ' + mins + ' min'
  const h = Math.floor(mins / 60)
  if (h < 24) return 'live in ' + h + 'h ' + (mins % 60) + 'm'
  return 'next live ' + status.at.toLocaleDateString(undefined, { weekday: 'short' }).toLowerCase() + ', ' + formatClock(status.at)
}
