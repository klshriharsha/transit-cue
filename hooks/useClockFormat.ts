'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// Times are stored canonically as 24h "HH:MM"; every visible time is rendered
// through formatClock so the native picker and "Your alerts" agree on one format —
// the viewer's locale. Rendering stays canonical until mount to avoid an
// SSR/client hydration mismatch when the server locale differs from the browser's.
export function useClockFormat() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)

  const formatClock = (value: string | Date): string => {
    let date: Date
    if (typeof value === 'string') {
      const [h, m] = value.split(':').map(Number)
      date = new Date()
      date.setHours(h, m, 0, 0)
    } else {
      date = value
    }
    if (!mounted) return typeof value === 'string' ? value : value.toTimeString().slice(0, 5)
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  }

  // Format hint for the time field's label, matching the viewer's locale.
  const clockHint =
    mounted && new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).resolvedOptions().hour12
      ? 'H:MM AM/PM'
      : 'HH:MM'

  return { mounted, formatClock, clockHint }
}
