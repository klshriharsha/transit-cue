import { MAX_COMMUTE_CONFIGS, type CommuteConfig } from '@/hooks/useCommuteConfig'
import { daysLabel, nextOccurrence, relativeLabel } from '@/lib/format'

type AlertsListProps = {
  alertsLoading: boolean
  hasAlerts: boolean
  alertCount: number
  savedConfigs: CommuteConfig[]
  on: boolean
  pendingDeleteId: string | null
  isDeleting: boolean
  pausingId: string | null
  onRequestDelete: (id: string) => void
  onCancelDelete: () => void
  onConfirmDelete: (id: string) => void
  onTogglePause: (id: string, paused: boolean) => void
  formatClock: (value: string | Date) => string
}

export function AlertsList({
  alertsLoading,
  hasAlerts,
  alertCount,
  savedConfigs,
  on,
  pendingDeleteId,
  isDeleting,
  pausingId,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onTogglePause,
  formatClock,
}: AlertsListProps) {
  return (
    <section className="min-w-0 flex-[1_1_400px]">
      <div className="flex items-baseline gap-2.5 px-1 pb-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">Your alerts</h2>
        <span className="font-mono text-xs text-sand-600">
          {!alertsLoading && hasAlerts ? `${alertCount} of ${MAX_COMMUTE_CONFIGS} scheduled` : ''}
        </span>
      </div>

      {alertsLoading && (
        <div className="rounded-[18px] border border-sand-900 bg-sand-1000 px-4.5 py-4 shadow-card">
          <div className="flex items-start gap-3.5">
            <div className="min-w-19 flex-none">
              <div className="h-5.5 w-15.5 animate-pulse-soft rounded bg-sand-920" />
              <div className="mt-1.75 h-2.5 w-11.5 animate-pulse-soft rounded bg-sand-930" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-[68%] animate-pulse-soft rounded bg-sand-920" />
              <div className="my-2 ml-[5.5px] h-2.5 w-0 border-l-2 border-dashed border-sand-880" />
              <div className="h-3.5 w-[54%] animate-pulse-soft rounded bg-sand-920" />
              <div className="mt-2.75 h-3 w-[40%] animate-pulse-soft rounded bg-sand-930" />
            </div>
          </div>
        </div>
      )}

      {!alertsLoading && !hasAlerts && (
        <div className="rounded-[20px] border-[1.5px] border-dashed border-sand-860 bg-sand-985 px-6 py-10 text-center">
          <div className="mx-auto mb-3.5 h-10 w-10 rounded-xl border-2 border-dashed border-sand-820" />
          <div className="text-[15px] font-semibold">No alerts yet</div>
          <div className="mt-1.5 font-mono text-xs leading-[1.6] text-sand-620">
            add your morning commute
            <br />
            on the left to get started
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!alertsLoading &&
          savedConfigs.map((config) => {
            const pending = pendingDeleteId === config.id
            const deleting = pending && isDeleting
            const paused = config.paused
            const pausing = pausingId === config.id
            return (
              <div
                key={config.id}
                className={`animate-in-260 rounded-[18px] border px-4.5 py-4 shadow-card ${
                  paused ? 'border-sand-920 bg-sand-990' : 'border-sand-900 bg-sand-1000'
                } ${on ? 'opacity-100' : 'opacity-55'}`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="min-w-19 flex-none text-left">
                    <div
                      className={`font-mono text-[22px] leading-none font-bold tracking-[-0.03em] ${paused ? 'text-ink-550' : ''}`}
                    >
                      {formatClock(config.pushTime)}
                    </div>
                    <div className="mt-1.25 font-mono text-[10px] tracking-[0.1em] text-sand-620 uppercase">
                      {daysLabel(config.repeatDays)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2.25">
                        <div className="h-2.25 w-2.25 flex-none rounded-full border-[2.5px] border-teal-accent" />
                        <div className="min-w-0 flex-1 overflow-hidden text-[14.5px] font-medium text-ellipsis whitespace-nowrap">{config.origin.name}</div>
                      </div>
                      {paused && (
                        <span className="inline-flex flex-none items-center gap-1 rounded-full bg-amber-tint px-2 py-0.75 font-mono text-[10px] tracking-[0.08em] text-amber-text uppercase">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="my-0.5 ml-[5.5px] h-2.5 w-0 border-l-2 border-dashed border-sand-880" />
                    <div className="flex items-center gap-2.25">
                      <div className="mx-[0.5px] h-2 w-2 flex-none rounded-xs bg-amber-accent" />
                      <div className="min-w-0 flex-1 overflow-hidden text-[14.5px] font-medium text-ellipsis whitespace-nowrap">{config.destination.name}</div>
                    </div>
                    <div className="mt-2.25 text-[12.5px] text-sand-600">
                      {!on ? 'notifications off — no pushes' : paused ? 'paused — no pushes' : relativeLabel(nextOccurrence(config.pushTime), formatClock)}
                    </div>
                  </div>
                  {!pending && (
                    <div className="flex flex-none items-center gap-2">
                      <button
                        onClick={() => onTogglePause(config.id, !paused)}
                        disabled={pausing}
                        aria-busy={pausing}
                        aria-label={paused ? 'Resume alert' : 'Pause alert'}
                        className="grid h-8 w-8 flex-none place-items-center rounded-[9px] border border-sand-920 bg-sand-990 text-ink-550 hover:border-sand-880 hover:bg-sand-980 disabled:cursor-wait disabled:opacity-60"
                      >
                        {pausing ? (
                          <span className="block h-3 w-3 animate-spin-fast rounded-full border-2 border-ink-550 border-t-transparent" />
                        ) : paused ? (
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M3.5 2.3c0-.9 1-1.45 1.77-.97l8.5 5.2c.73.45.73 1.5 0 1.94l-8.5 5.2c-.77.48-1.77-.07-1.77-.97V2.3Z" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <rect x="3" y="2" width="3.5" height="12" rx="1" />
                            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => onRequestDelete(config.id)}
                        aria-label="Delete alert"
                        className="h-8 w-8 flex-none rounded-[9px] border border-sand-920 bg-sand-990 text-[15px] leading-none text-ink-550 hover:border-red-hover-border hover:bg-red-hover-bg hover:text-red-hover-text"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                {pending && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-sand-940 pt-3.25">
                    <span className="flex-[1_1_140px] text-[13.5px] text-ink-450">Delete this alert?</span>
                    <button
                      onClick={onCancelDelete}
                      disabled={deleting}
                      className="rounded-[9px] border border-sand-880 bg-sand-1000 px-3.5 py-2 text-[13.5px] font-medium text-ink-400 disabled:cursor-wait disabled:opacity-55"
                    >
                      Keep
                    </button>
                    <button
                      onClick={() => onConfirmDelete(config.id)}
                      disabled={deleting}
                      aria-busy={deleting}
                      className="flex items-center gap-2 rounded-[9px] border-0 bg-red-accent px-3.5 py-2 text-[13.5px] font-semibold text-red-on-accent disabled:cursor-wait disabled:opacity-75"
                    >
                      {deleting && (
                        <span className="block h-3 w-3 animate-spin-fast rounded-full border-2 border-red-on-accent border-t-transparent" />
                      )}
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {!alertsLoading && hasAlerts && (
        <div className="mt-3.5 rounded-[14px] border border-teal-tint-border bg-teal-tint/60 px-4 py-3 text-[13px] leading-[1.5] text-teal-tint-text">
          {on
            ? 'TransitCue keeps working when the tab is closed — install it to your home screen for the most reliable delivery.'
            : 'Turn notifications back on above to resume these pushes.'}
        </div>
      )}
    </section>
  )
}
