'use client'
import { useEffect, useState } from 'react'
import { Plus, Loader2, Train, X, ToggleLeft, ToggleRight, Search, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { adminApi } from '@/lib/adminApi'
import { adminApi as stationsAdminApi } from '@/lib/adminApi'
import type { TrainResponse, StationResponse, SeatClassEnum } from '@/types'
import { formatTime, CLASS_LABELS, runsDays } from '@/lib/utils'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

const DAYS_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ALL_CLASSES: SeatClassEnum[] = ['SL', '3A', '2A', '1A', 'CC', 'EC', 'GN']

const DEFAULT_FARE: Record<SeatClassEnum, number> = {
  SL: 0.45, '3A': 2.05, '2A': 2.95, '1A': 4.60, CC: 1.25, EC: 2.10, GN: 0.20,
}

interface ClassRow {
  class_type: SeatClassEnum
  total_seats: number
  rac_seats: number
  waitlist_quota: number
  base_fare_per_km: number
  enabled: boolean
}

interface StopRow {
  station_code: string
  stop_order: number
  arrival_time: string
  departure_time: string
  distance_km: number
}

export default function AdminTrains() {
  const { token } = useAuthStore()
  const [trains,   setTrains]   = useState<TrainResponse[]>([])
  const [stations, setStations] = useState<StationResponse[]>([])
  const [loading,  setLoading]  = useState(true)
  const [query,    setQuery]    = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    train_number: '', train_name: '',
    source_station_code: '', destination_station_code: '',
    departure_time: '', arrival_time: '',
    duration_mins: '', total_distance_km: '',
    days_of_week: [] as number[],
  })
  const [classes, setClasses] = useState<ClassRow[]>(
    ALL_CLASSES.map(c => ({
      class_type: c, total_seats: 64, rac_seats: 10, waitlist_quota: 50,
      base_fare_per_km: DEFAULT_FARE[c], enabled: c === '3A' || c === 'SL',
    }))
  )
  const [stops, setStops] = useState<StopRow[]>([
    { station_code: '', stop_order: 1, arrival_time: '', departure_time: '', distance_km: 0 },
    { station_code: '', stop_order: 2, arrival_time: '', departure_time: '', distance_km: 0 },
  ])

  useEffect(() => { if (token) { loadTrains(); loadStations() } }, [token])

  async function loadTrains() {
    setLoading(true)
    try {
      // listTrains searches all station pairs to discover trains — may take a few seconds
      const data = await adminApi.listTrains(token!)
      setTrains(data)
      if (data.length === 0) toast('No trains found. Make sure seed_data.py has been run.', { icon: 'ℹ️' })
    } catch (e: any) {
      toast.error(`Could not load trains: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadStations() {
    try { setStations(await stationsAdminApi.listStations(token!)) }
    catch {}
  }

  function upd(f: string, v: string) { setForm(x => ({ ...x, [f]: v })) }

  function toggleDay(d: number) {
    setForm(x => ({
      ...x,
      days_of_week: x.days_of_week.includes(d)
        ? x.days_of_week.filter(n => n !== d)
        : [...x.days_of_week, d].sort(),
    }))
  }

  function updClass(i: number, f: keyof ClassRow, v: any) {
    setClasses(prev => prev.map((c, idx) => idx === i ? { ...c, [f]: v } : c))
  }

  function updStop(i: number, f: keyof StopRow, v: any) {
    setStops(prev => prev.map((s, idx) => idx === i ? { ...s, [f]: v } : s))
  }

  function addStop() {
    setStops(prev => [...prev, {
      station_code: '', stop_order: prev.length + 1,
      arrival_time: '', departure_time: '', distance_km: 0,
    }])
  }

  function removeStop(i: number) {
    setStops(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, stop_order: idx + 1 })))
  }

  async function toggleStatus(t: TrainResponse) {
    setToggling(t.id)
    try {
      await adminApi.setTrainStatus(token!, t.id, !t.is_active)
      setTrains(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
      toast.success(`${t.train_number} ${!t.is_active ? 'activated' : 'deactivated'}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setToggling(null) }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (form.days_of_week.length === 0) { toast.error('Select at least one running day'); return }
    const enabledClasses = classes.filter(c => c.enabled)
    if (enabledClasses.length === 0) { toast.error('Enable at least one seat class'); return }
    const validStops = stops.filter(s => s.station_code)
    if (validStops.length < 2) { toast.error('Add at least 2 stops (origin and destination)'); return }

    setSaving(true)
    try {
      await adminApi.createTrain(token!, {
        train_number: form.train_number,
        train_name: form.train_name,
        source_station_code: form.source_station_code.toUpperCase(),
        destination_station_code: form.destination_station_code.toUpperCase(),
        departure_time: form.departure_time,
        arrival_time: form.arrival_time,
        duration_mins: parseInt(form.duration_mins),
        total_distance_km: parseInt(form.total_distance_km),
        days_of_week: form.days_of_week,
        seat_classes: enabledClasses.map(({ enabled, ...c }) => c),
        stops: validStops.map(s => ({
          ...s,
          station_code: s.station_code.toUpperCase(),
          arrival_time: s.arrival_time || null,
          departure_time: s.departure_time || null,
        })),
      })
      toast.success(`Train ${form.train_number} created!`)
      setShowForm(false)
      loadTrains()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const filtered = trains.filter(t =>
    t.train_number.includes(query) ||
    t.train_name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trains</h1>
          <p className="text-sm text-slate-500 mt-0.5">{trains.length} trains in system</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add train
        </button>
      </div>

      {/* Search */}
      <div className="card mb-5 flex items-center gap-2 px-4 py-2.5">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search by number or name…"
          className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400"
        />
      </div>

      {/* Train list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-400">Discovering trains across all routes…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className={cn('card overflow-hidden transition', !t.is_active && 'opacity-60')}>
              {/* Train row */}
              <div className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50">
                  <Train className="h-5 w-5 text-navy-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-500">{t.train_number}</span>
                    <span className="font-semibold text-slate-900 truncate">{t.train_name}</span>
                    {!t.is_active && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.source_station.code} → {t.destination_station.code} ·{' '}
                    {formatTime(t.departure_time)} – {formatTime(t.arrival_time)} ·{' '}
                    {runsDays(t.days_of_week)}
                  </p>
                </div>

                {/* Classes pills */}
                <div className="hidden md:flex gap-1.5 flex-wrap">
                  {t.seat_classes.map(c => (
                    <span key={c.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {c.class_type} <span className="text-slate-400">{c.available_seats}av</span>
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleStatus(t)}
                    disabled={toggling === t.id}
                    title={t.is_active ? 'Deactivate train' : 'Activate train'}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                      t.is_active
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    )}
                  >
                    {toggling === t.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : t.is_active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                    {t.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                  >
                    {expanded === t.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === t.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-4 text-xs animate-fade-in">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 font-semibold text-slate-600 uppercase tracking-wide">Seat classes & fares</p>
                      <table className="w-full">
                        <thead><tr className="text-left text-slate-400">
                          <th className="pb-1.5">Class</th><th className="pb-1.5">Seats</th>
                          <th className="pb-1.5">RAC</th><th className="pb-1.5">WL quota</th>
                          <th className="pb-1.5">₹/km</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-200">
                          {t.seat_classes.map(c => (
                            <tr key={c.id} className="text-slate-700">
                              <td className="py-1.5 font-semibold">{CLASS_LABELS[c.class_type]}</td>
                              <td className="py-1.5">{c.total_seats}</td>
                              <td className="py-1.5">{c.rac_seats}</td>
                              <td className="py-1.5">{c.waitlist_quota}</td>
                              <td className="py-1.5">₹{c.base_fare_per_km}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <p className="mb-2 font-semibold text-slate-600 uppercase tracking-wide">Route info</p>
                      <div className="space-y-1 text-slate-600">
                        <p>Distance: <strong>{t.total_distance_km} km</strong></p>
                        <p>Duration: <strong>{Math.floor(t.duration_mins/60)}h {t.duration_mins%60}m</strong></p>
                        <p>Runs on: <strong>{runsDays(t.days_of_week)}</strong></p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="card py-16 text-center text-slate-400">No trains found</div>
          )}
        </div>
      )}

      {/* Add train modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 animate-fade-in">
          <div className="flex min-h-full items-start justify-center p-4 sm:pt-10">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl animate-slide-up">
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50">
                    <Train className="h-4 w-4 text-navy-600" />
                  </div>
                  <h2 className="font-semibold text-slate-900">Add train</h2>
                </div>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-6">

                {/* Basic info */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Basic information</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Train number *</label>
                      <input value={form.train_number} onChange={e => upd('train_number', e.target.value)}
                        placeholder="e.g. 12951" className="input font-mono" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Train name *</label>
                      <input value={form.train_name} onChange={e => upd('train_name', e.target.value)}
                        placeholder="e.g. Mumbai Rajdhani Express" className="input" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Source station code *</label>
                      <input value={form.source_station_code} onChange={e => upd('source_station_code', e.target.value.toUpperCase())}
                        placeholder="NDLS" list="station-list" className="input font-mono uppercase" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Destination station code *</label>
                      <input value={form.destination_station_code} onChange={e => upd('destination_station_code', e.target.value.toUpperCase())}
                        placeholder="CSTM" list="station-list" className="input font-mono uppercase" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Departure time *</label>
                      <input type="time" value={form.departure_time} onChange={e => upd('departure_time', e.target.value)} className="input" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Arrival time *</label>
                      <input type="time" value={form.arrival_time} onChange={e => upd('arrival_time', e.target.value)} className="input" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Duration (minutes) *</label>
                      <input type="number" value={form.duration_mins} onChange={e => upd('duration_mins', e.target.value)}
                        placeholder="e.g. 915" min={1} className="input" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Total distance (km) *</label>
                      <input type="number" value={form.total_distance_km} onChange={e => upd('total_distance_km', e.target.value)}
                        placeholder="e.g. 1384" min={1} className="input" required />
                    </div>
                  </div>
                </div>

                {/* Running days */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Runs on *</h3>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS_LABELS.map((d, i) => (
                      <button
                        key={i} type="button"
                        onClick={() => toggleDay(i)}
                        className={cn(
                          'h-9 w-12 rounded-lg border text-xs font-medium transition',
                          form.days_of_week.includes(i)
                            ? 'border-navy-600 bg-navy-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        )}
                      >
                        {d}
                      </button>
                    ))}
                    <button type="button" onClick={() => setForm(f => ({ ...f, days_of_week: [0,1,2,3,4,5,6] }))}
                      className="rounded-lg border border-slate-200 px-3 text-xs text-slate-500 hover:bg-slate-50 transition">
                      Daily
                    </button>
                  </div>
                </div>

                {/* Seat classes */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Seat classes & fares</h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500">
                          <th className="px-3 py-2.5 w-6"></th>
                          <th className="px-3 py-2.5">Class</th>
                          <th className="px-3 py-2.5">Seats</th>
                          <th className="px-3 py-2.5">RAC</th>
                          <th className="px-3 py-2.5">WL quota</th>
                          <th className="px-3 py-2.5">₹ / km</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classes.map((c, i) => (
                          <tr key={c.class_type} className={cn('transition', !c.enabled && 'opacity-40 bg-slate-50')}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={c.enabled}
                                onChange={e => updClass(i, 'enabled', e.target.checked)}
                                className="accent-navy-600" />
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-700">
                              {c.class_type} <span className="font-normal text-slate-400">— {CLASS_LABELS[c.class_type]}</span>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={c.total_seats} disabled={!c.enabled}
                                onChange={e => updClass(i, 'total_seats', parseInt(e.target.value))}
                                min={1} className="w-16 rounded border border-slate-200 px-1.5 py-1 text-center disabled:bg-slate-50" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={c.rac_seats} disabled={!c.enabled}
                                onChange={e => updClass(i, 'rac_seats', parseInt(e.target.value))}
                                min={0} className="w-14 rounded border border-slate-200 px-1.5 py-1 text-center disabled:bg-slate-50" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={c.waitlist_quota} disabled={!c.enabled}
                                onChange={e => updClass(i, 'waitlist_quota', parseInt(e.target.value))}
                                min={0} className="w-14 rounded border border-slate-200 px-1.5 py-1 text-center disabled:bg-slate-50" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.01" value={c.base_fare_per_km} disabled={!c.enabled}
                                onChange={e => updClass(i, 'base_fare_per_km', parseFloat(e.target.value))}
                                min={0.01} className="w-16 rounded border border-slate-200 px-1.5 py-1 text-center disabled:bg-slate-50" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Stops */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route stops</h3>
                    <button type="button" onClick={addStop} className="text-xs text-navy-600 hover:underline">+ Add stop</button>
                  </div>
                  <datalist id="station-list">
                    {stations.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}
                  </datalist>
                  <div className="space-y-2">
                    {stops.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-600 text-xs font-bold text-white">
                          {i + 1}
                        </span>
                        <input
                          value={s.station_code}
                          onChange={e => updStop(i, 'station_code', e.target.value.toUpperCase())}
                          placeholder="Code" list="station-list"
                          className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono uppercase"
                        />
                        <div className="flex flex-1 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400">Arrive</span>
                            <input type="time" value={s.arrival_time} onChange={e => updStop(i, 'arrival_time', e.target.value)}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400">Depart</span>
                            <input type="time" value={s.departure_time} onChange={e => updStop(i, 'departure_time', e.target.value)}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400">km from origin</span>
                            <input type="number" value={s.distance_km} onChange={e => updStop(i, 'distance_km', parseInt(e.target.value))}
                              min={0} className="w-16 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs" />
                          </div>
                        </div>
                        {stops.length > 2 && (
                          <button type="button" onClick={() => removeStop(i)} className="text-red-400 hover:text-red-600 transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1">
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating train…</> : 'Create train'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
