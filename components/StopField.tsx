'use client'

import { useEffect, useState } from 'react'
import { MAX_STATION_QUERY_LENGTH } from '@/lib/limits'
import type { Station } from '@/lib/types'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

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

export function StopField({ id, label, placeholder, variant, value, onChange }: StopFieldProps) {
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
        maxLength={MAX_STATION_QUERY_LENGTH}
        placeholder={placeholder}
        value={query}
        className={`h-9.5 w-full rounded-xl border border-sand-880 bg-sand-990 px-3.5 py-0 text-[15px] text-ink-240 outline-none ${focusRing}`}
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
          <div className="max-h-72 overflow-y-auto">
            {results.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(s)}
                className={`block w-full border-b border-sand-950 py-2.75 px-3.5 text-left ${i === highlight ? 'bg-teal-hover-bg' : 'bg-sand-1000'}`}
              >
                <span className="block text-[14.5px] font-medium text-ink-240">{s.name}</span>
                <span className="mt-0.5 block overflow-hidden font-mono text-[11px] text-ellipsis whitespace-nowrap text-sand-600">
                  stop
                </span>
              </button>
            ))}
          </div>
          <div className="bg-sand-980 px-3.5 py-2 font-mono text-[10px] tracking-[0.08em] text-sand-700 uppercase">
            {sourceNote}
          </div>
        </div>
      )}
    </div>
  )
}
