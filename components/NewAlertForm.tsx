import { MAX_COMMUTE_CONFIGS } from '@/hooks/useCommuteConfig'
import { currentClock, DAYS, daysLabel } from '@/lib/format'
import type { Station } from '@/lib/types'
import { StopField } from './StopField'

type NewAlertFormProps = {
  fromStation: Station | null
  toStation: Station | null
  onFromChange: (station: Station | null) => void
  onToChange: (station: Station | null) => void
  onSwap: () => void
  swapKey: number
  pushTime: string
  onPushTimeChange: (value: string) => void
  clockHint: string
  days: number[]
  onToggleDay: (day: number) => void
  onSave: () => void
  canSave: boolean
  isSaving: boolean
  atCapacity: boolean
  formatClock: (value: string | Date) => string
}

export function NewAlertForm({
  fromStation,
  toStation,
  onFromChange,
  onToChange,
  onSwap,
  swapKey,
  pushTime,
  onPushTimeChange,
  clockHint,
  days,
  onToggleDay,
  onSave,
  canSave,
  isSaving,
  atCapacity,
  formatClock,
}: NewAlertFormProps) {
  return (
    <section className="min-w-0 flex-[1_1_360px] rounded-[20px] border border-sand-900 bg-sand-1000 p-[clamp(18px,3vw,24px)] shadow-card">
      <div className="mb-4.5 flex items-baseline gap-2.5">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">New commute alert</h2>
        <span className="font-mono text-[11px] tracking-[0.1em] text-sand-680 uppercase">step 2</span>
      </div>

      <div className="flex items-stretch gap-3">
        <div className="flex w-3.5 flex-none flex-col items-center pt-4 pb-4.5">
          <div className="h-2.75 w-2.75 flex-none rounded-full border-[3px] border-teal-accent bg-sand-1000" />
          <div className="my-1 w-0 flex-1 border-l-2 border-dashed border-sand-860" />
          <div className="h-2.5 w-2.5 flex-none rounded-xs bg-amber-accent" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <StopField
            key={'from-' + swapKey}
            id="onw-from"
            label="From stop"
            placeholder="Start typing a stop or station…"
            variant="from"
            value={fromStation}
            onChange={onFromChange}
          />
          <StopField
            key={'to-' + swapKey}
            id="onw-to"
            label="To stop"
            placeholder="Where are you headed?"
            variant="to"
            value={toStation}
            onChange={onToChange}
          />
        </div>

        <div className="flex flex-none items-center">
          <button
            onClick={onSwap}
            aria-label="Swap stops"
            className="h-9.5 w-9.5 rounded-[10px] border border-sand-880 bg-sand-990 text-[15px] leading-none text-ink-420 hover:border-sand-800 hover:bg-sand-950"
          >
            ⇅
          </button>
        </div>
      </div>

      <div className="my-5 h-px bg-sand-930" />

      <div className="flex flex-wrap items-end gap-4.5">
        <div className="flex-[0_1_150px]">
          <label htmlFor="onw-time" className="mb-1.5 block font-mono text-[10.5px] tracking-[0.12em] text-sand-600 uppercase">
            Push at ({clockHint})
          </label>
          <input
            id="onw-time"
            type="time"
            // The native picker renders in the browser's locale; every other
            // visible time goes through formatClock() with that same locale so
            // the two stay consistent. Stored value is always 24h "HH:MM".
            value={pushTime}
            onChange={(e) => onPushTimeChange(e.target.value || currentClock())}
            className="w-full rounded-xl border border-sand-880 bg-sand-990 px-3 py-2.75 font-mono text-xl font-medium tracking-[-0.01em] text-ink-240 outline-none focus:border-teal-accent focus:shadow-[0_0_0_3px_oklch(0.55_0.11_195_/_13%)]"
          />
        </div>
        <div className="flex-[1_1_190px]">
          <div className="mb-1.5 font-mono text-[10.5px] tracking-[0.12em] text-sand-600 uppercase">Repeat</div>
          <div className="flex gap-1.25">
            {DAYS.map(([letter, full], i) => {
              const active = days.includes(i)
              return (
                <button
                  key={full}
                  onClick={() => onToggleDay(i)}
                  aria-label={full}
                  className={`h-9.5 min-w-0 flex-1 rounded-[10px] border text-[12.5px] font-semibold ${
                    active ? 'border-teal-accent bg-teal-accent text-teal-on-accent' : 'border-sand-880 bg-sand-990 text-ink-500'
                  }`}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={!canSave || isSaving}
        className={`mt-5 w-full rounded-xl border-0 p-3.75 text-[15px] font-semibold text-teal-on-accent ${
          canSave ? 'cursor-pointer bg-teal-deep' : 'cursor-not-allowed bg-sand-880'
        }`}
      >
        {isSaving
          ? 'Saving…'
          : atCapacity
            ? `Limit of ${MAX_COMMUTE_CONFIGS} alerts reached`
            : canSave
              ? 'Schedule this alert'
              : 'Add both stops to continue'}
      </button>
      <div className="mt-2.5 min-h-4.5 text-center text-[12.5px] text-sand-620">
        {atCapacity
          ? 'Delete an alert on the right to add another.'
          : canSave
            ? formatClock(pushTime) + ' · ' + daysLabel(days)
            : 'Pick a suggestion for both stops to continue.'}
      </div>
    </section>
  )
}
