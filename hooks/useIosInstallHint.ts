'use client'

import { useSyncExternalStore } from 'react'
import { isIosOutsideHomeScreenApp } from '@/lib/platform'

const subscribe = () => () => {}

// Reads navigator/matchMedia, which aren't available during SSR, so this stays false until
// mount (same pattern as useClockFormat) to avoid a hydration mismatch.
export function useIosInstallHint() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)

  return mounted && isIosOutsideHomeScreenApp(window.navigator)
}
