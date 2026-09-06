'use client'

import { useEffect, useRef, useState } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useCommuteConfig, type Station } from '@/hooks/useCommuteConfig'

const DAYS: [string, string][] = [
  ['S', 'Sunday'],
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
]
const DEFAULT_DAYS = [1, 2, 3, 4, 5]
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

function daysLabel(days: number[]): string {
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

function nextOccurrence(pushTime: string): Date | null {
  const [h, m] = pushTime.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const now = new Date()
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
  if (candidate > now) return candidate
  candidate.setDate(candidate.getDate() + 1)
  return candidate
}

function relativeLabel(d: Date | null): string {
  if (!d) return 'not scheduled'
  const mins = Math.round((d.getTime() - Date.now()) / 60000)
  if (mins < 60) return 'next push in ' + mins + ' min'
  const h = Math.floor(mins / 60)
  if (h < 24) return 'next push in ' + h + 'h ' + (mins % 60) + 'm'
  return 'next push tomorrow, ' + d.toTimeString().slice(0, 5)
}

async function searchStations(query: string): Promise<Station[]> {
  const response = await fetch(`/api/stations/search?query=${encodeURIComponent(query)}`)

  if (!response.ok) {
    throw new Error('The API could not search for stations.')
  }

  const data = (await response.json()) as { stations: Station[] }
  return data.stations
}

type StopFieldProps = {
  id: string
  label: string
  placeholder: string
  variant: 'from' | 'to'
  value: Station | null
  onChange: (station: Station | null) => void
}

function StopField({ id, label, placeholder, variant, value, onChange }: StopFieldProps) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [results, setResults] = useState<Station[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [syncedId, setSyncedId] = useState(value?.id ?? null)

  if (value && value.id !== syncedId) {
    setSyncedId(value.id)
    setQuery(value.name)
  } else if (!value && syncedId !== null) {
    setSyncedId(null)
  }

  useEffect(() => {
    let ignore = false
    const shouldSearch = !value && query.trim().length >= MIN_QUERY_LENGTH

    const timer = setTimeout(
      () => {
        if (ignore) return

        if (!shouldSearch) {
          setResults([])
          setLoading(false)
          return
        }

        setLoading(true)

        searchStations(query.trim())
          .then((stations) => {
            if (!ignore) setResults(stations)
          })
          .catch(() => {
            if (!ignore) setResults([])
          })
          .finally(() => {
            if (!ignore) setLoading(false)
          })
      },
      shouldSearch ? DEBOUNCE_MS : 0,
    )

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [query, value])

  const select = (station: Station) => {
    onChange(station)
    setQuery(station.name)
    setOpen(false)
    setHighlight(-1)
  }

  const showDropdown = open && !value && query.trim().length >= MIN_QUERY_LENGTH
  const sourceNote = loading ? 'searching…' : results.length ? results.length + ' match' + (results.length === 1 ? '' : 'es') : 'no stations found'

  const focusRing =
    variant === 'from'
      ? 'focus:border-teal-accent focus:bg-sand-1000 focus:shadow-[0_0_0_3px_oklch(0.55_0.11_195_/_13%)]'
      : 'focus:border-amber-accent focus:bg-sand-1000 focus:shadow-[0_0_0_3px_oklch(0.6_0.13_60_/_13%)]'

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block font-mono text-[10.5px] tracking-[0.12em] text-sand-600 uppercase">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        className={`w-full rounded-xl border border-sand-880 bg-sand-990 p-[13px_14px] text-[15px] text-ink-240 outline-none ${focusRing}`}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          if (value && next !== value.name) onChange(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          const n = results.length
          if (e.key === 'ArrowDown' && n) {
            e.preventDefault()
            setHighlight((h) => (h + 1) % n)
          } else if (e.key === 'ArrowUp' && n) {
            e.preventDefault()
            setHighlight((h) => (h - 1 + n) % n)
          } else if (e.key === 'Enter' && highlight >= 0 && results[highlight]) {
            e.preventDefault()
            select(results[highlight])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {showDropdown && (
        <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-40 animate-in-140 overflow-hidden rounded-[14px] border border-sand-880 bg-sand-1000 shadow-dropdown">
          {results.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(s)}
              className={`block w-full border-b border-sand-950 p-[11px_14px] text-left ${i === highlight ? 'bg-teal-hover-bg' : 'bg-sand-1000'}`}
            >
              <span className="block text-[14.5px] font-medium text-ink-240">{s.name}</span>
              <span className="mt-0.5 block overflow-hidden font-mono text-[11px] text-ellipsis whitespace-nowrap text-sand-600">
                stop
              </span>
            </button>
          ))}
          <div className="bg-sand-980 px-3.5 py-2 font-mono text-[10px] tracking-[0.08em] text-sand-700 uppercase">
            {sourceNote}
          </div>
        </div>
      )}
    </div>
  )
}

export default function OnwardPage() {
  const push = usePushSubscription()
  const commute = useCommuteConfig(push.subscription)

  const [fromStation, setFromStation] = useState<Station | null>(null)
  const [toStation, setToStation] = useState<Station | null>(null)
  const [pushTime, setPushTime] = useState('08:15')
  const [days, setDays] = useState<number[]>(DEFAULT_DAYS)
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Bumped on every StopField swap so the two fields re-sync their internal query text from
  // the swapped `value` props (StopField already re-syncs on `value.id` change).
  const [swapKey, setSwapKey] = useState(0)

  const flash = (message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }

  const on = push.isSubscribed
  const needsPermission = !push.granted
  const isGranted = push.granted
  const hasAlerts = commute.savedConfig !== null
  const canSave = Boolean(fromStation && toStation && days.length)

  const handleSave = async () => {
    if (!canSave || !fromStation || !toStation) return
    const result = await commute.save(fromStation, toStation, pushTime)
    if (result.config) {
      setFromStation(null)
      setToStation(null)
      flash('Alert saved · ' + pushTime)
    } else {
      flash(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-sand-972 pb-16 font-sans text-ink-240">
      <header className="sticky top-0 z-[60] border-b border-sand-900 bg-sand-972/88 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center gap-[14px] px-[clamp(16px,4vw,28px)]">
          <div className="flex items-center gap-2.5">
            <div className="grid h-[26px] w-[26px] place-items-center rounded-lg bg-teal-accent">
              <div className="h-2 w-2 rounded-full bg-teal-on-accent-alt" />
            </div>
            <span className="text-[18px] font-bold tracking-[-0.02em]">Onward</span>
          </div>
          <span className="pt-0.5 font-mono text-[11px] tracking-[0.1em] text-sand-600 uppercase">
            transit nudges
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-2 rounded-full border border-sand-900 bg-sand-1000 py-1.5 pr-3 pl-2.5">
            <div
              className={`h-[7px] w-[7px] rounded-full ${on ? 'bg-green-accent' : isGranted ? 'bg-amber-muted' : 'bg-sand-780'}`}
            />
            <span className="text-[13px] font-medium text-ink-420">{on ? 'Notifications on' : isGranted ? 'Paused' : 'Not enabled'}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-[clamp(16px,4vw,28px)] pt-[clamp(20px,4vw,36px)]">
        {needsPermission && (
          <section className="mb-5 flex flex-wrap items-center gap-[clamp(18px,3vw,32px)] rounded-[20px] border border-sand-900 bg-sand-1000 p-[clamp(20px,4vw,32px)] shadow-card">
            <div className="min-w-0 flex-[1_1_300px]">
              <div className="inline-flex items-center gap-2 rounded-md bg-amber-tint px-2.5 py-[5px] font-mono text-[11px] tracking-[0.12em] text-amber-text uppercase">
                step 1 of 2
              </div>
              <h1 className="mt-3.5 mb-2.5 text-[clamp(26px,4.2vw,36px)] leading-[1.08] font-bold tracking-[-0.03em] text-balance">
                Never sprint for the bus again.
              </h1>
              <p className="max-w-[46ch] text-[16px] leading-[1.55] text-ink-480 text-pretty">
                Onward pushes a notification at the exact minute you need to leave. Allow notifications once — everything after that lives on this device.
              </p>
              <div className="mt-[22px] flex flex-wrap items-center gap-2.5">
                <button
                  onClick={push.subscribe}
                  disabled={push.busy}
                  className="rounded-xl border-0 bg-teal-deep p-[14px_22px] text-[15px] font-semibold text-teal-on-accent shadow-cta hover:bg-teal-deep-hover"
                >
                  Enable notifications
                </button>
                <span className="text-[13px] text-sand-600">
                  {push.error ?? (push.permissionDenied ? 'Blocked in browser settings — re-allow there, then reload.' : 'One tap. No account, no email.')}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-[0_1_300px]">
              <div className="flex animate-in-400 items-start gap-3 rounded-2xl border border-sand-900 bg-sand-975 p-3.5">
                <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-teal-accent font-mono text-[9px] font-bold tracking-[0.04em] text-teal-on-accent-alt">
                  ON
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">Onward · now</div>
                  <div className="mt-0.5 text-[13px] leading-[1.45] text-ink-450">
                    Leave in 6 min for the 8:15 — Congress Ave → 4th &amp; Guadalupe.
                  </div>
                </div>
              </div>
              <div className="mt-2.5 text-center font-mono text-[10px] tracking-[0.1em] text-sand-680 uppercase">
                example push
              </div>
            </div>
          </section>
        )}

        {isGranted && (
          <section className="mb-5 flex flex-wrap items-center gap-3.5 rounded-2xl border border-sand-900 bg-sand-1000 p-[16px_18px] shadow-card">
            <div className="min-w-0 flex-[1_1_240px]">
              <div className="text-[15px] font-semibold">Push notifications</div>
              <div className="mt-[3px] text-[13.5px] text-ink-520">
                {on
                  ? hasAlerts
                    ? 'Delivering 1 scheduled alert to this device.'
                    : 'Ready — add your first alert below.'
                  : 'Paused. Your alerts are kept, but nothing will be pushed.'}
              </div>
            </div>
            <button
              onClick={() => (on ? push.unsubscribe() : push.subscribe())}
              aria-label="Toggle all notifications"
              className="flex items-center gap-2.5 border-0 bg-transparent p-0"
            >
              <span className="font-mono text-[11px] tracking-[0.1em] text-ink-550 uppercase">
                {on ? 'On' : 'Off'}
              </span>
              <span
                className={`block h-7 w-12 rounded-full p-[3px] [transition:background_160ms_ease] ${on ? 'bg-teal-accent' : 'bg-sand-860'}`}
              >
                <span
                  className={`block h-[22px] w-[22px] rounded-full bg-sand-1000 shadow-knob [transition:transform_160ms_ease] ${on ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </span>
            </button>
          </section>
        )}

        <div className="flex flex-wrap items-start gap-5">
          <section className="min-w-0 flex-[1_1_360px] rounded-[20px] border border-sand-900 bg-sand-1000 p-[clamp(18px,3vw,24px)] shadow-card">
            <div className="mb-[18px] flex items-baseline gap-2.5">
              <h2 className="text-[19px] font-bold tracking-[-0.02em]">New commute alert</h2>
              <span className="font-mono text-[11px] tracking-[0.1em] text-sand-680 uppercase">
                step 2
              </span>
            </div>

            <div className="flex items-stretch gap-3">
              <div className="flex w-[14px] flex-none flex-col items-center pt-4 pb-[18px]">
                <div className="h-[11px] w-[11px] flex-none rounded-full border-[3px] border-teal-accent bg-sand-1000" />
                <div className="my-1 w-0 flex-1 border-l-2 border-dashed border-sand-860" />
                <div className="h-[10px] w-[10px] flex-none rounded-[2px] bg-amber-accent" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <StopField
                  key={'from-' + swapKey}
                  id="onw-from"
                  label="From stop"
                  placeholder="Start typing a stop or station…"
                  variant="from"
                  value={fromStation}
                  onChange={setFromStation}
                />
                <StopField
                  key={'to-' + swapKey}
                  id="onw-to"
                  label="To stop"
                  placeholder="Where are you headed?"
                  variant="to"
                  value={toStation}
                  onChange={setToStation}
                />
              </div>

              <div className="flex flex-none items-center">
                <button
                  onClick={() => {
                    setFromStation(toStation)
                    setToStation(fromStation)
                    setSwapKey((k) => k + 1)
                  }}
                  aria-label="Swap stops"
                  className="h-[38px] w-[38px] rounded-[10px] border border-sand-880 bg-sand-990 text-[15px] leading-none text-ink-420 hover:border-sand-800 hover:bg-sand-950"
                >
                  ⇅
                </button>
              </div>
            </div>

            <div className="my-5 h-px bg-sand-930" />

            <div className="flex flex-wrap items-end gap-[18px]">
              <div className="flex-[0_1_150px]">
                <label htmlFor="onw-time" className="mb-1.5 block font-mono text-[10.5px] tracking-[0.12em] text-sand-600 uppercase">
                  Push at (HH:MM)
                </label>
                <input
                  id="onw-time"
                  type="time"
                  value={pushTime}
                  onChange={(e) => setPushTime(e.target.value || '08:15')}
                  className="w-full rounded-xl border border-sand-880 bg-sand-990 px-3 py-[11px] font-mono text-[20px] font-medium tracking-[-0.01em] text-ink-240 outline-none focus:border-teal-accent focus:shadow-[0_0_0_3px_oklch(0.55_0.11_195_/_13%)]"
                />
              </div>
              <div className="flex-[1_1_190px]">
                <div className="mb-1.5 font-mono text-[10.5px] tracking-[0.12em] text-sand-600 uppercase">
                  Repeat
                </div>
                <div className="flex gap-[5px]">
                  {DAYS.map(([letter, full], i) => {
                    const active = days.includes(i)
                    return (
                      <button
                        key={full}
                        onClick={() => setDays((d) => (active ? d.filter((x) => x !== i) : d.concat([i])))}
                        aria-label={full}
                        className={`h-[38px] min-w-0 flex-1 rounded-[10px] border text-[12.5px] font-semibold ${
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
              onClick={handleSave}
              disabled={!canSave || commute.isSaving}
              className={`mt-5 w-full rounded-xl border-0 p-[15px] text-[15px] font-semibold text-teal-on-accent ${
                canSave ? 'cursor-pointer bg-teal-deep' : 'cursor-not-allowed bg-sand-880'
              }`}
            >
              {commute.isSaving ? 'Saving…' : canSave ? 'Schedule this alert' : 'Add both stops to continue'}
            </button>
            <div className="mt-2.5 min-h-[18px] text-center text-[12.5px] text-sand-620">
              {canSave ? pushTime + ' · ' + daysLabel(days) : 'Pick a suggestion for both stops to continue.'}
            </div>
          </section>

          <section className="min-w-0 flex-[1_1_400px]">
            <div className="flex items-baseline gap-2.5 px-1 pb-3">
              <h2 className="text-[19px] font-bold tracking-[-0.02em]">Your alerts</h2>
              <span className="font-mono text-[12px] text-sand-600">{hasAlerts ? '1 scheduled' : ''}</span>
            </div>

            {!hasAlerts && (
              <div className="rounded-[20px] border-[1.5px] border-dashed border-sand-860 bg-sand-985 px-6 py-10 text-center">
                <div className="mx-auto mb-3.5 h-10 w-10 rounded-xl border-2 border-dashed border-sand-820" />
                <div className="text-[15px] font-semibold">No alerts yet</div>
                <div className="mt-1.5 font-mono text-[12px] leading-[1.6] text-sand-620">
                  add your morning commute
                  <br />
                  on the left to get started
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {commute.savedConfig && (
                <div
                  className={`animate-in-260 rounded-[18px] border border-sand-900 bg-sand-1000 px-[18px] py-4 shadow-card ${on ? 'opacity-100' : 'opacity-55'}`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="min-w-[76px] flex-none text-left">
                      <div className="font-mono text-[22px] leading-none font-bold tracking-[-0.03em]">
                        {commute.savedConfig.pushTime}
                      </div>
                      <div className="mt-[5px] font-mono text-[10px] tracking-[0.1em] text-sand-620 uppercase">
                        every day
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-[9px]">
                        <div className="h-[9px] w-[9px] flex-none rounded-full border-[2.5px] border-teal-accent" />
                        <div className="min-w-0 flex-1 overflow-hidden text-[14.5px] font-medium text-ellipsis whitespace-nowrap">{commute.savedConfig.origin.name}</div>
                      </div>
                      <div className="my-0.5 ml-[5.5px] h-[10px] w-0 border-l-2 border-dashed border-sand-880" />
                      <div className="flex items-center gap-[9px]">
                        <div className="mx-[0.5px] h-2 w-2 flex-none rounded-[2px] bg-amber-accent" />
                        <div className="min-w-0 flex-1 overflow-hidden text-[14.5px] font-medium text-ellipsis whitespace-nowrap">{commute.savedConfig.destination.name}</div>
                      </div>
                      <div className="mt-[9px] text-[12.5px] text-sand-600">
                        {on ? relativeLabel(nextOccurrence(commute.savedConfig.pushTime)) : 'paused — no pushes'}
                      </div>
                    </div>
                    {!pending && (
                      <button
                        onClick={() => setPending(true)}
                        aria-label="Delete alert"
                        className="h-8 w-8 flex-none rounded-[9px] border border-sand-920 bg-sand-990 text-[15px] leading-none text-ink-550 hover:border-red-hover-border hover:bg-red-hover-bg hover:text-red-hover-text"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {pending && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-sand-940 pt-[13px]">
                      <span className="flex-[1_1_140px] text-[13.5px] text-ink-450">Delete this alert?</span>
                      <button
                        onClick={() => setPending(false)}
                        className="rounded-[9px] border border-sand-880 bg-sand-1000 px-3.5 py-2 text-[13.5px] font-medium text-ink-400"
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => {
                          // TODO: wire to a real DELETE /api/config once that endpoint exists —
                          // the backend is upsert-only today, so there is nothing to delete yet.
                          setPending(false)
                        }}
                        className="rounded-[9px] border-0 bg-red-accent px-3.5 py-2 text-[13.5px] font-semibold text-red-on-accent"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {hasAlerts && (
              <div className="mt-3.5 rounded-[14px] border border-teal-tint-border bg-teal-tint/60 px-4 py-3 text-[13px] leading-[1.5] text-teal-tint-text">
                {on ? 'Onward keeps working when the tab is closed — install it to your home screen for the most reliable delivery.' : 'Turn notifications back on above to resume these pushes.'}
              </div>
            )}
          </section>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-[22px] left-1/2 z-[80] max-w-[calc(100vw-32px)] -translate-x-1/2 animate-in-200 rounded-full bg-ink-260 px-[18px] py-3 text-center text-[14px] font-medium text-sand-980 shadow-toast">
          {toast}
        </div>
      )}
    </div>
  )
}
