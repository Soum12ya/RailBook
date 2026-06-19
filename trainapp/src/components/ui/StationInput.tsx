'use client'
import { useState, useRef, useEffect } from 'react'
import { MapPin, Loader2, X } from 'lucide-react'
import { stationsApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Props {
  value: string           // station CODE — controlled by parent
  displayName: string     // "NDLS — New Delhi" — controlled by parent
  onChange: (code: string, name: string) => void
  placeholder?: string
  label?: string
}

interface Station { code: string; name: string; city: string; state: string }

export default function StationInput({
  value, displayName, onChange, placeholder = 'Station code or city', label
}: Props) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Station[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const ref   = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setFocused(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // The value the input actually shows:
  // - while typing: show the query
  // - when focused but nothing typed yet: show nothing (placeholder shows)
  // - when blurred and a station is selected: show displayName
  const inputValue = focused ? query : (value ? displayName : '')

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    setOpen(true)
    clearTimeout(timer.current)
    if (v.length < 1) { setResults([]); return }
    setLoading(true)
    timer.current = setTimeout(async () => {
      try {
        const data = await stationsApi.searchES(v)
        setResults(data as Station[])
      } catch {
        try {
          const data = await stationsApi.list(v)
          setResults(data.slice(0, 8) as Station[])
        } catch {}
      } finally {
        setLoading(false)
      }
    }, 280)
  }

  function handleFocus() {
    setFocused(true)
    setQuery('')
    if (results.length) setOpen(true)
  }

  function handleBlur() {
    // delay so onMouseDown on a result fires first
    setTimeout(() => {
      setFocused(false)
      setQuery('')
      setOpen(false)
    }, 150)
  }

  function select(s: Station) {
    onChange(s.code, s.name)
    setQuery('')
    setResults([])
    setOpen(false)
    setFocused(false)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('', '')
    setQuery('')
    setResults([])
  }

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </label>
      )}
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={inputValue}
          onChange={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            'input pl-9 pr-8 transition',
            value && !focused && 'font-medium text-slate-800'
          )}
          autoComplete="off"
        />
        {/* Right icon: spinner while loading, clear X when a station is selected */}
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : value && !focused ? (
          <button
            type="button"
            onMouseDown={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-fade-in">
          {results.map(s => (
            <button
              key={s.code}
              type="button"
              onMouseDown={() => select(s)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
            >
              <span className="min-w-[44px] rounded-md bg-navy-600 px-2 py-0.5 text-center text-xs font-bold text-white">
                {s.code}
              </span>
              <div>
                <div className="text-sm font-medium text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-400">{s.city}, {s.state}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
