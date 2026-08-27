'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './page.module.css'
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

  return (
    <div style={{ position: 'relative' }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10.5px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'oklch(0.6 0.01 85)',
          marginBottom: '6px',
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        className={variant === 'from' ? styles.fromInput : styles.toInput}
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
        style={{
          width: '100%',
          border: '1px solid oklch(0.88 0.012 85)',
          borderRadius: '12px',
          padding: '13px 14px',
          fontSize: '15px',
          color: 'oklch(0.24 0.015 80)',
          background: 'oklch(0.99 0.004 85)',
          outline: 'none',
        }}
      />
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'oklch(1 0 0)',
            border: '1px solid oklch(0.88 0.012 85)',
            borderRadius: '14px',
            boxShadow: '0 12px 28px oklch(0.4 0.02 85 / 0.16)',
            overflow: 'hidden',
            animation: 'onw-in 140ms ease both',
          }}
        >
          {results.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => select(s)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: i === highlight ? 'oklch(0.96 0.02 195)' : 'oklch(1 0 0)',
                padding: '11px 14px',
                display: 'block',
                borderBottom: '1px solid oklch(0.95 0.008 85)',
              }}
            >
              <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 500, color: 'oklch(0.24 0.015 80)' }}>{s.name}</span>
              <span
                style={{
                  display: 'block',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: 'oklch(0.6 0.01 85)',
                  marginTop: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                stop
              </span>
            </button>
          ))}
          <div
            style={{
              padding: '8px 14px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'oklch(0.7 0.01 85)',
              background: 'oklch(0.98 0.005 85)',
            }}
          >
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
    <div
      style={{
        minHeight: '100vh',
        background: 'oklch(0.972 0.008 85)',
        color: 'oklch(0.24 0.015 80)',
        fontFamily: "'Instrument Sans', Helvetica, Arial, sans-serif",
        paddingBottom: '64px',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          background: 'oklch(0.972 0.008 85 / 0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid oklch(0.9 0.012 85)',
        }}
      >
        <div
          style={{
            maxWidth: '1080px',
            margin: '0 auto',
            padding: '0 clamp(16px, 4vw, 28px)',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'oklch(0.55 0.11 195)', display: 'grid', placeItems: 'center' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '999px', background: 'oklch(0.99 0.01 195)' }} />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>Onward</span>
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'oklch(0.6 0.01 85)',
              paddingTop: '2px',
            }}
          >
            transit nudges
          </span>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px 6px 10px',
              border: '1px solid oklch(0.9 0.012 85)',
              borderRadius: '999px',
              background: 'oklch(1 0 0)',
            }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '999px',
                background: on ? 'oklch(0.62 0.15 145)' : isGranted ? 'oklch(0.7 0.13 60)' : 'oklch(0.78 0.01 85)',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'oklch(0.42 0.015 80)' }}>{on ? 'Notifications on' : isGranted ? 'Paused' : 'Not enabled'}</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: 'clamp(20px, 4vw, 36px) clamp(16px, 4vw, 28px) 0' }}>
        {needsPermission && (
          <section
            style={{
              border: '1px solid oklch(0.9 0.012 85)',
              borderRadius: '20px',
              background: 'oklch(1 0 0)',
              padding: 'clamp(20px, 4vw, 32px)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'clamp(18px, 3vw, 32px)',
              alignItems: 'center',
              boxShadow: '0 1px 2px oklch(0.5 0.02 85 / 0.05)',
              marginBottom: '20px',
            }}
          >
            <div style={{ flex: '1 1 300px', minWidth: 0 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'oklch(0.58 0.11 60)',
                  background: 'oklch(0.95 0.03 60)',
                  padding: '5px 10px',
                  borderRadius: '6px',
                }}
              >
                step 1 of 2
              </div>
              <h1
                style={{
                  fontSize: 'clamp(26px, 4.2vw, 36px)',
                  lineHeight: 1.08,
                  letterSpacing: '-0.03em',
                  margin: '14px 0 10px',
                  fontWeight: 700,
                  textWrap: 'balance',
                }}
              >
                Never sprint for the bus again.
              </h1>
              <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.55, color: 'oklch(0.48 0.015 80)', maxWidth: '46ch', textWrap: 'pretty' }}>
                Onward pushes a notification at the exact minute you need to leave. Allow notifications once — everything after that lives on this device.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '22px' }}>
                <button
                  onClick={push.subscribe}
                  disabled={push.busy}
                  className={styles.enableButton}
                  style={{
                    border: 'none',
                    borderRadius: '12px',
                    background: 'oklch(0.42 0.09 195)',
                    color: 'oklch(0.99 0.005 195)',
                    fontSize: '15px',
                    fontWeight: 600,
                    padding: '14px 22px',
                    boxShadow: '0 1px 2px oklch(0.3 0.05 195 / 0.3)',
                  }}
                >
                  Enable notifications
                </button>
                <span style={{ fontSize: '13px', color: 'oklch(0.6 0.01 85)' }}>
                  {push.error ?? (push.permissionDenied ? 'Blocked in browser settings — re-allow there, then reload.' : 'One tap. No account, no email.')}
                </span>
              </div>
            </div>
            <div style={{ flex: '0 1 300px', minWidth: 0 }}>
              <div
                style={{
                  border: '1px solid oklch(0.9 0.012 85)',
                  borderRadius: '16px',
                  background: 'oklch(0.975 0.006 85)',
                  padding: '14px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  animation: 'onw-in 400ms ease both',
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'oklch(0.55 0.11 195)',
                    flex: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '9px',
                    fontWeight: 700,
                    color: 'oklch(0.99 0.01 195)',
                    letterSpacing: '0.04em',
                  }}
                >
                  ON
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Onward · now</div>
                  <div style={{ fontSize: '13px', color: 'oklch(0.45 0.015 80)', lineHeight: 1.45, marginTop: '2px' }}>
                    Leave in 6 min for the 8:15 — Congress Ave → 4th &amp; Guadalupe.
                  </div>
                </div>
              </div>
              <div
                style={{
                  textAlign: 'center',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'oklch(0.68 0.01 85)',
                  marginTop: '10px',
                }}
              >
                example push
              </div>
            </div>
          </section>
        )}

        {isGranted && (
          <section
            style={{
              border: '1px solid oklch(0.9 0.012 85)',
              borderRadius: '16px',
              background: 'oklch(1 0 0)',
              padding: '16px 18px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              alignItems: 'center',
              boxShadow: '0 1px 2px oklch(0.5 0.02 85 / 0.05)',
              marginBottom: '20px',
            }}
          >
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Push notifications</div>
              <div style={{ fontSize: '13.5px', color: 'oklch(0.52 0.015 80)', marginTop: '3px' }}>
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
              style={{ border: 'none', padding: 0, background: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'oklch(0.55 0.015 80)' }}>
                {on ? 'On' : 'Off'}
              </span>
              <span
                style={{
                  width: '48px',
                  height: '28px',
                  borderRadius: '999px',
                  padding: '3px',
                  display: 'block',
                  transition: 'background 160ms ease',
                  background: on ? 'oklch(0.55 0.11 195)' : 'oklch(0.86 0.012 85)',
                }}
              >
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '999px',
                    background: 'oklch(1 0 0)',
                    display: 'block',
                    boxShadow: '0 1px 3px oklch(0.3 0.02 85 / 0.35)',
                    transition: 'transform 160ms ease',
                    transform: on ? 'translateX(20px)' : 'translateX(0)',
                  }}
                />
              </span>
            </button>
          </section>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
          <section
            style={{
              flex: '1 1 360px',
              minWidth: 0,
              border: '1px solid oklch(0.9 0.012 85)',
              borderRadius: '20px',
              background: 'oklch(1 0 0)',
              padding: 'clamp(18px, 3vw, 24px)',
              boxShadow: '0 1px 2px oklch(0.5 0.02 85 / 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, letterSpacing: '-0.02em' }}>New commute alert</h2>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'oklch(0.68 0.01 85)' }}>
                step 2
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
              <div style={{ flex: 'none', width: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 18px' }}>
                <div style={{ width: '11px', height: '11px', borderRadius: '999px', border: '3px solid oklch(0.55 0.11 195)', background: 'oklch(1 0 0)', flex: 'none' }} />
                <div style={{ flex: 1, width: 0, borderLeft: '2px dashed oklch(0.86 0.012 85)', margin: '4px 0' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'oklch(0.6 0.13 60)', flex: 'none' }} />
              </div>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

              <div style={{ flex: 'none', display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    setFromStation(toStation)
                    setToStation(fromStation)
                    setSwapKey((k) => k + 1)
                  }}
                  aria-label="Swap stops"
                  className={styles.swapButton}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid oklch(0.88 0.012 85)',
                    background: 'oklch(0.99 0.004 85)',
                    fontSize: '15px',
                    color: 'oklch(0.45 0.015 80)',
                    lineHeight: 1,
                  }}
                >
                  ⇅
                </button>
              </div>
            </div>

            <div style={{ height: '1px', background: 'oklch(0.93 0.01 85)', margin: '20px 0' }} />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'flex-end' }}>
              <div style={{ flex: '0 1 150px' }}>
                <label
                  htmlFor="onw-time"
                  style={{
                    display: 'block',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10.5px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'oklch(0.6 0.01 85)',
                    marginBottom: '6px',
                  }}
                >
                  Push at (HH:MM)
                </label>
                <input
                  id="onw-time"
                  type="time"
                  value={pushTime}
                  onChange={(e) => setPushTime(e.target.value || '08:15')}
                  className={styles.timeInput}
                  style={{
                    width: '100%',
                    border: '1px solid oklch(0.88 0.012 85)',
                    borderRadius: '12px',
                    padding: '11px 12px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '20px',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: 'oklch(0.24 0.015 80)',
                    background: 'oklch(0.99 0.004 85)',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ flex: '1 1 190px' }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10.5px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'oklch(0.6 0.01 85)',
                    marginBottom: '6px',
                  }}
                >
                  Repeat
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {DAYS.map(([letter, full], i) => {
                    const active = days.includes(i)
                    return (
                      <button
                        key={full}
                        onClick={() => setDays((d) => (active ? d.filter((x) => x !== i) : d.concat([i])))}
                        aria-label={full}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: '38px',
                          borderRadius: '10px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          border: '1px solid ' + (active ? 'oklch(0.55 0.11 195)' : 'oklch(0.88 0.012 85)'),
                          background: active ? 'oklch(0.55 0.11 195)' : 'oklch(0.99 0.004 85)',
                          color: active ? 'oklch(0.99 0.005 195)' : 'oklch(0.5 0.015 80)',
                        }}
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
              style={{
                width: '100%',
                marginTop: '20px',
                border: 'none',
                borderRadius: '12px',
                padding: '15px',
                fontSize: '15px',
                fontWeight: 600,
                color: 'oklch(0.99 0.005 195)',
                background: canSave ? 'oklch(0.42 0.09 195)' : 'oklch(0.88 0.012 85)',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              {commute.isSaving ? 'Saving…' : canSave ? 'Schedule this alert' : 'Add both stops to continue'}
            </button>
            <div style={{ fontSize: '12.5px', color: 'oklch(0.62 0.01 85)', textAlign: 'center', marginTop: '10px', minHeight: '18px' }}>
              {canSave ? pushTime + ' · ' + daysLabel(days) : 'Pick a suggestion for both stops to continue.'}
            </div>
          </section>

          <section style={{ flex: '1 1 400px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '0 4px 12px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, letterSpacing: '-0.02em' }}>Your alerts</h2>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'oklch(0.6 0.01 85)' }}>{hasAlerts ? '1 scheduled' : ''}</span>
            </div>

            {!hasAlerts && (
              <div style={{ border: '1.5px dashed oklch(0.86 0.012 85)', borderRadius: '20px', padding: '40px 24px', textAlign: 'center', background: 'oklch(0.985 0.005 85)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', border: '2px dashed oklch(0.82 0.012 85)', margin: '0 auto 14px' }} />
                <div style={{ fontSize: '15px', fontWeight: 600 }}>No alerts yet</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'oklch(0.62 0.01 85)', marginTop: '6px', lineHeight: 1.6 }}>
                  add your morning commute
                  <br />
                  on the left to get started
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {commute.savedConfig && (
                <div
                  style={{
                    border: '1px solid oklch(0.9 0.012 85)',
                    borderRadius: '18px',
                    background: 'oklch(1 0 0)',
                    padding: '16px 18px',
                    boxShadow: '0 1px 2px oklch(0.5 0.02 85 / 0.05)',
                    animation: 'onw-in 260ms ease both',
                    opacity: on ? 1 : 0.55,
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 'none', textAlign: 'left', minWidth: '76px' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {commute.savedConfig.pushTime}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'oklch(0.62 0.01 85)', marginTop: '5px' }}>
                        every day
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '9px', alignItems: 'center' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '999px', border: '2.5px solid oklch(0.55 0.11 195)', flex: 'none' }} />
                        <div style={{ fontSize: '14.5px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commute.savedConfig.origin.name}</div>
                      </div>
                      <div style={{ width: 0, height: '10px', borderLeft: '2px dashed oklch(0.88 0.012 85)', margin: '2px 0 2px 5.5px' }} />
                      <div style={{ display: 'flex', gap: '9px', alignItems: 'center' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'oklch(0.6 0.13 60)', flex: 'none', margin: '0 0.5px' }} />
                        <div style={{ fontSize: '14.5px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commute.savedConfig.destination.name}</div>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'oklch(0.6 0.01 85)', marginTop: '9px' }}>
                        {on ? relativeLabel(nextOccurrence(commute.savedConfig.pushTime)) : 'paused — no pushes'}
                      </div>
                    </div>
                    {!pending && (
                      <button
                        onClick={() => setPending(true)}
                        aria-label="Delete alert"
                        className={styles.deleteButton}
                        style={{
                          flex: 'none',
                          width: '32px',
                          height: '32px',
                          borderRadius: '9px',
                          border: '1px solid oklch(0.92 0.012 85)',
                          background: 'oklch(0.99 0.004 85)',
                          color: 'oklch(0.55 0.015 80)',
                          fontSize: '15px',
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {pending && (
                    <div style={{ marginTop: '14px', paddingTop: '13px', borderTop: '1px solid oklch(0.94 0.01 85)', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <span style={{ flex: '1 1 140px', fontSize: '13.5px', color: 'oklch(0.45 0.015 80)' }}>Delete this alert?</span>
                      <button
                        onClick={() => setPending(false)}
                        style={{ border: '1px solid oklch(0.88 0.012 85)', background: 'oklch(1 0 0)', borderRadius: '9px', padding: '8px 14px', fontSize: '13.5px', fontWeight: 500, color: 'oklch(0.4 0.015 80)' }}
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => {
                          // TODO: wire to a real DELETE /api/config once that endpoint exists —
                          // the backend is upsert-only today, so there is nothing to delete yet.
                          setPending(false)
                        }}
                        style={{ border: 'none', background: 'oklch(0.5 0.15 25)', color: 'oklch(0.99 0.01 25)', borderRadius: '9px', padding: '8px 14px', fontSize: '13.5px', fontWeight: 600 }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {hasAlerts && (
              <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '14px', background: 'oklch(0.95 0.012 195 / 0.6)', border: '1px solid oklch(0.88 0.02 195)', fontSize: '13px', color: 'oklch(0.4 0.05 195)', lineHeight: 1.5 }}>
                {on ? 'Onward keeps working when the tab is closed — install it to your home screen for the most reliable delivery.' : 'Turn notifications back on above to resume these pushes.'}
              </div>
            )}
          </section>
        </div>
      </main>

      {toast && (
        <div
          style={{
            position: 'fixed',
            zIndex: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: '22px',
            background: 'oklch(0.26 0.015 80)',
            color: 'oklch(0.98 0.005 85)',
            padding: '12px 18px',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 8px 24px oklch(0.3 0.02 85 / 0.3)',
            animation: 'onw-in 200ms ease both',
            maxWidth: 'calc(100vw - 32px)',
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
