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

export function nextOccurrence(pushTime: string): Date | null {
  const [h, m] = pushTime.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const now = new Date()
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
  if (candidate > now) return candidate
  candidate.setDate(candidate.getDate() + 1)
  return candidate
}

export function relativeLabel(d: Date | null, formatClock: (value: Date) => string): string {
  if (!d) return 'not scheduled'
  const mins = Math.round((d.getTime() - Date.now()) / 60000)
  if (mins < 60) return 'next push in ' + mins + ' min'
  const h = Math.floor(mins / 60)
  if (h < 24) return 'next push in ' + h + 'h ' + (mins % 60) + 'm'
  return 'next push tomorrow, ' + formatClock(d)
}
