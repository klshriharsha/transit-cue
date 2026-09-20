type PushToggleCardProps = {
  on: boolean
  busy: boolean
  hasAlerts: boolean
  activeAlertCount: number
  onToggle: () => void
}

function statusMessage(on: boolean, hasAlerts: boolean, activeAlertCount: number): string {
  if (!on) return 'Paused. Your alerts are kept, but nothing will be pushed.'
  if (!hasAlerts) return 'Ready — add your first alert below.'
  if (activeAlertCount === 0) return 'All alerts are paused — nothing will be pushed.'
  return `Delivering ${activeAlertCount} scheduled alert${activeAlertCount === 1 ? '' : 's'} to this device.`
}

export function PushToggleCard({ on, busy, hasAlerts, activeAlertCount, onToggle }: PushToggleCardProps) {
  return (
    <section className="mb-5 flex flex-wrap items-center gap-3.5 rounded-2xl border border-sand-900 bg-sand-1000 py-4 px-4.5 shadow-card">
      <div className="min-w-0 flex-[1_1_240px]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-amber-tint px-2.5 py-1.25 font-mono text-[11px] tracking-[0.12em] text-amber-text uppercase">
          step 1 of 2
        </div>
        <div className="text-[15px] font-semibold">Push notifications</div>
        <div className="mt-0.75 text-[13.5px] text-ink-520">{statusMessage(on, hasAlerts, activeAlertCount)}</div>
      </div>
      <button
        onClick={onToggle}
        disabled={busy}
        aria-busy={busy}
        aria-label="Toggle all notifications"
        className="flex items-center gap-2.5 border-0 bg-transparent p-0 disabled:cursor-wait"
      >
        <span className="font-mono text-[11px] tracking-[0.1em] text-ink-550 uppercase">
          {busy ? (on ? 'Turning off…' : 'Turning on…') : on ? 'On' : 'Off'}
        </span>
        <span
          className={`block h-7 w-12 rounded-full p-0.75 [transition:background_160ms_ease] ${
            busy ? 'bg-sand-780' : on ? 'bg-teal-accent' : 'bg-sand-860'
          }`}
        >
          <span
            className={`grid h-5.5 w-5.5 place-items-center rounded-full bg-sand-1000 shadow-knob [transition:transform_160ms_ease] ${
              on ? 'translate-x-5' : 'translate-x-0'
            }`}
          >
            {busy && <span className="block h-3 w-3 animate-spin-fast rounded-full border-2 border-sand-780 border-t-transparent" />}
          </span>
        </span>
      </button>
    </section>
  )
}
