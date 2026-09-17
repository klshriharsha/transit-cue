'use client'

import { useState } from 'react'
import { AlertsList } from '@/components/AlertsList'
import { AppHeader } from '@/components/AppHeader'
import { NewAlertForm } from '@/components/NewAlertForm'
import { OnboardingHero } from '@/components/OnboardingHero'
import { PushToggleCard } from '@/components/PushToggleCard'
import { Toast } from '@/components/Toast'
import { useClockFormat } from '@/hooks/useClockFormat'
import { MAX_COMMUTE_CONFIGS, useCommuteConfig } from '@/hooks/useCommuteConfig'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useToast } from '@/hooks/useToast'
import { currentClock, DEFAULT_DAYS } from '@/lib/format'
import type { Station } from '@/lib/types'

export default function TransitCuePage() {
  const push = usePushSubscription()
  const commute = useCommuteConfig(push.subscription)
  const { mounted, formatClock, clockHint } = useClockFormat()
  const { toast, flash } = useToast()

  const [fromStation, setFromStation] = useState<Station | null>(null)
  const [toStation, setToStation] = useState<Station | null>(null)
  // Starts unset so the picker's SSR markup is stable, then snaps to the viewer's
  // current time once mounted — set during render (like StopField's prop sync
  // below) instead of a useEffect, so there's no extra commit-then-correct step.
  const [pushTime, setPushTime] = useState<string | null>(null)
  if (mounted && pushTime === null) {
    setPushTime(currentClock())
  }
  const activePushTime = pushTime ?? '08:15'
  const [days, setDays] = useState<number[]>(DEFAULT_DAYS)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // Bumped on every StopField swap so the two fields re-sync their internal query text from
  // the swapped `value` props (StopField already re-syncs on `value.id` change).
  const [swapKey, setSwapKey] = useState(0)

  const bootstrapping = push.initializing
  const on = push.isSubscribed
  const needsPermission = !push.granted
  const isGranted = push.granted
  const alertCount = commute.savedConfigs.length
  const hasAlerts = alertCount > 0
  const atCapacity = alertCount >= MAX_COMMUTE_CONFIGS
  const alertsLoading = bootstrapping || commute.isLoading
  const canSave = Boolean(fromStation && toStation && days.length && !atCapacity)

  const handleSave = async () => {
    if (!canSave || !fromStation || !toStation) return
    const result = await commute.add(fromStation, toStation, activePushTime)
    if (result.config) {
      setFromStation(null)
      setToStation(null)
      // StopField keeps its own query text internally and only re-syncs it from `value` on an
      // id change, so clearing the station state above doesn't clear the visible input text.
      // Remounting both fields (same trick the swap button uses) resets that text too.
      setSwapKey((k) => k + 1)
      flash('Alert saved · ' + formatClock(activePushTime))
    } else {
      flash(result.error)
    }
  }

  const handleSwap = () => {
    setFromStation(toStation)
    setToStation(fromStation)
    setSwapKey((k) => k + 1)
  }

  const handleToggleDay = (day: number) => {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : d.concat([day])))
  }

  const handleDelete = async (id: string) => {
    const result = await commute.remove(id)
    setPendingDeleteId(null)
    if (result.error) flash(result.error)
  }

  return (
    <div className="min-h-screen bg-sand-972 pb-16 font-sans text-ink-240">
      <AppHeader bootstrapping={bootstrapping} on={on} isGranted={isGranted} />

      <main className="mx-auto max-w-270 px-[clamp(16px,4vw,28px)] pt-[clamp(20px,4vw,36px)]">
        {bootstrapping && (
          <section className="mb-5 rounded-2xl border border-sand-900 bg-sand-1000 py-4 px-4.5 shadow-card">
            <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-amber-tint px-2.5 py-1.25 font-mono text-[11px] tracking-[0.12em] text-amber-text uppercase">
              step 1 of 2
            </div>
            <div className="h-4.25 w-42 max-w-full animate-pulse-soft rounded bg-sand-920" />
            <div className="mt-2.5 h-3.25 w-66 max-w-full animate-pulse-soft rounded bg-sand-930" />
          </section>
        )}

        {!bootstrapping && needsPermission && (
          <OnboardingHero
            onSubscribe={push.subscribe}
            busy={push.busy}
            error={push.error}
            permissionDenied={push.permissionDenied}
          />
        )}

        {!bootstrapping && isGranted && (
          <PushToggleCard
            on={on}
            busy={push.busy}
            hasAlerts={hasAlerts}
            alertCount={alertCount}
            onToggle={() => (on ? push.unsubscribe() : push.subscribe())}
          />
        )}

        <div className="flex flex-wrap items-start gap-5">
          <NewAlertForm
            fromStation={fromStation}
            toStation={toStation}
            onFromChange={setFromStation}
            onToChange={setToStation}
            onSwap={handleSwap}
            swapKey={swapKey}
            pushTime={activePushTime}
            onPushTimeChange={setPushTime}
            clockHint={clockHint}
            days={days}
            onToggleDay={handleToggleDay}
            onSave={handleSave}
            canSave={canSave}
            isSaving={commute.isSaving}
            atCapacity={atCapacity}
            formatClock={formatClock}
          />

          <AlertsList
            alertsLoading={alertsLoading}
            hasAlerts={hasAlerts}
            alertCount={alertCount}
            savedConfigs={commute.savedConfigs}
            on={on}
            pendingDeleteId={pendingDeleteId}
            onRequestDelete={setPendingDeleteId}
            onCancelDelete={() => setPendingDeleteId(null)}
            onConfirmDelete={handleDelete}
            formatClock={formatClock}
          />
        </div>
      </main>

      <Toast message={toast} />
    </div>
  )
}
