'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowLeftRight, Loader2, X, AlertCircle } from 'lucide-react'
import { trainsApi, bookingsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import StationInput from '@/components/ui/StationInput'
import TrainCard from '@/components/booking/TrainCard'
import PassengerForm from '@/components/booking/PassengerForm'
import type { TrainAvailability, SeatClassEnum, PassengerCreate, BookingCreate } from '@/types'
import { todayStr, CLASS_LABELS, generateIdempotencyKey } from '@/lib/utils'
import toast from 'react-hot-toast'

interface StationField { code: string; name: string }

interface BookingModal {
  train: TrainAvailability
  classId: string
  classType: SeatClassEnum
}

export default function SearchPage() {
  const router = useRouter()
  const { token } = useAuthStore()

  // ── Search form state ──────────────────────────────────────────────────
  const [from, setFrom] = useState<StationField>({ code: '', name: '' })
  const [to,   setTo]   = useState<StationField>({ code: '', name: '' })
  const [date, setDate] = useState(todayStr())
  const [classFilter, setClassFilter] = useState<SeatClassEnum | ''>('')

  // ── Results ────────────────────────────────────────────────────────────
  const [results,   setResults]   = useState<TrainAvailability[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')

  // ── Booking modal ──────────────────────────────────────────────────────
  const [modal,      setModal]      = useState<BookingModal | null>(null)
  const [passengers, setPassengers] = useState<PassengerCreate[]>([
    { full_name: '', age: 0, gender: 'M', berth_preference: 'NO' },
  ])
  const [booking, setBooking] = useState(false)

  // ── Swap — swaps both code and display name ────────────────────────────
  function swap() {
    if (!from.code && !to.code) return
    setFrom({ ...to })
    setTo({ ...from })
  }

  // ── Search ─────────────────────────────────────────────────────────────
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!from.code) { toast.error('Please select origin station'); return }
    if (!to.code)   { toast.error('Please select destination station'); return }
    if (from.code === to.code) { toast.error('Origin and destination cannot be the same'); return }
    setSearching(true)
    setSearchErr('')
    setResults(null)
    try {
      const data = await trainsApi.search({
        source_station_code: from.code,
        destination_station_code: to.code,
        journey_date: date,
        class_type: classFilter || undefined,
      })
      setResults(data)
      if (data.length === 0) setSearchErr('No trains found for this route.')
    } catch (err: any) {
      setSearchErr(err.message || 'Search failed. Is your backend running?')
    } finally {
      setSearching(false)
    }
  }

  // ── Open booking modal ─────────────────────────────────────────────────
  function openBooking(train: TrainAvailability, classId: string, classType: SeatClassEnum) {
    if (!token) {
      toast.error('Please sign in to book tickets')
      router.push('/auth/login')
      return
    }
    setModal({ train, classId, classType })
    setPassengers([{ full_name: '', age: 0, gender: 'M', berth_preference: 'NO' }])
  }

  // ── Confirm booking ────────────────────────────────────────────────────
  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!modal || !token) return
    const invalid = passengers.find(p => !p.full_name.trim() || p.age < 1)
    if (invalid) { toast.error('Fill in all passenger details correctly'); return }

    setBooking(true)
    const payload: BookingCreate = {
      train_id:                 modal.train.train_id,
      seat_class_id:            modal.classId,
      source_station_code:      from.code,
      destination_station_code: to.code,
      journey_date:             date,
      passengers,
    }
    try {
      const result = await bookingsApi.create(payload, token, generateIdempotencyKey())
      toast.success(`Booking confirmed! PNR: ${result.pnr}`)
      setModal(null)
      router.push(`/bookings/${result.id}`)
    } catch (err: any) {
      toast.error(err.message || 'Booking failed')
    } finally {
      setBooking(false)
    }
  }

  const selectedClass = modal
    ? modal.train.available_classes.find(c => c.id === modal.classId)
    : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Search trains</h1>

      {/* ── Search form ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="card mb-8 p-5">

        {/* Station row */}
        <div className="flex items-end gap-2">
          {/* From */}
          <div className="flex-1">
            <StationInput
              value={from.code}
              displayName={from.code ? `${from.code} — ${from.name}` : ''}
              onChange={(code, name) => setFrom({ code, name })}
              placeholder="Origin station or city"
              label="From"
            />
          </div>

          {/* Swap button */}
          <button
            type="button"
            onClick={swap}
            title="Swap stations"
            className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-navy-400 hover:bg-navy-50 hover:text-navy-600 active:scale-90"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>

          {/* To */}
          <div className="flex-1">
            <StationInput
              value={to.code}
              displayName={to.code ? `${to.code} — ${to.name}` : ''}
              onChange={(code, name) => setTo({ code, name })}
              placeholder="Destination station or city"
              label="To"
            />
          </div>
        </div>

        {/* Date + class + button row */}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Journey date
            </label>
            <input
              type="date"
              value={date}
              min={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Class (optional)
            </label>
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value as SeatClassEnum | '')}
              className="input"
            >
              <option value="">All classes</option>
              {(['SL', '3A', '2A', '1A', 'CC', 'EC', 'GN'] as SeatClassEnum[]).map(c => (
                <option key={c} value={c}>{CLASS_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={searching} className="btn-primary h-[42px] w-full sm:w-auto px-6">
              {searching
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</>
                : <><Search className="h-4 w-4" /> Search</>}
            </button>
          </div>
        </div>
      </form>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {searchErr && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" /> {searchErr}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {results !== null && !searchErr && (
        <div className="space-y-4 animate-slide-up">
          <p className="text-sm text-slate-500">
            {results.length} train{results.length !== 1 ? 's' : ''} found
            {' '}· {from.code} → {to.code} · {date}
          </p>
          {results.map(t => (
            <TrainCard key={t.train_id} train={t} journeyDate={date} onBook={openBooking} />
          ))}
        </div>
      )}

      {/* ── Booking modal ────────────────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center animate-fade-in"
          onClick={() => !booking && setModal(null)}
        >
          <div
            className="w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{modal.train.train_name}</h2>
                <p className="text-xs text-slate-500">
                  {CLASS_LABELS[modal.classType]} · {from.code} → {to.code} · {date}
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleBook} className="space-y-5 p-6">
              <PassengerForm passengers={passengers} onChange={setPassengers} />

              {/* Availability summary */}
              {selectedClass && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Availability</span>
                    <span className="font-medium text-slate-900">
                      {selectedClass.available_seats > 0
                        ? `${selectedClass.available_seats} confirmed seats`
                        : selectedClass.rac_available > 0
                        ? `${selectedClass.rac_available} RAC seats`
                        : `WL ${selectedClass.current_waitlist} / ${selectedClass.waitlist_quota}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Passengers</span>
                    <span className="font-medium text-slate-900">{passengers.length}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-200">
                    <span>Final fare calculated at checkout based on route distance</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={booking}
                className="btn-amber w-full py-3 text-base font-semibold"
              >
                {booking
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking…</>
                  : 'Confirm booking'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
