'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Loader2, Train, Users, MapPin, Calendar } from 'lucide-react'
import { bookingsApi } from '@/lib/api'
import type { PNRStatusResponse } from '@/types'
import { formatDate, formatTime, formatAmount } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import toast from 'react-hot-toast'

export default function PNRPage() {
  const params = useSearchParams()
  const [pnr, setPnr] = useState(params.get('pnr') || '')
  const [result, setResult] = useState<PNRStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (params.get('pnr')) checkPNR(params.get('pnr')!)
  }, [])

  async function checkPNR(p = pnr) {
    if (!p || p.length !== 10) { toast.error('Enter a valid 10-digit PNR'); return }
    setLoading(true)
    setResult(null)
    try {
      const data = await bookingsApi.pnr(p)
      setResult(data)
    } catch (err: any) {
      toast.error(err.message || 'PNR not found')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">PNR Status</h1>

      <div className="card mb-8 p-5">
        <div className="flex gap-3">
          <input
            type="text"
            value={pnr}
            onChange={e => setPnr(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={e => e.key === 'Enter' && checkPNR()}
            placeholder="Enter 10-digit PNR"
            maxLength={10}
            className="input flex-1 font-mono text-lg tracking-widest"
          />
          <button onClick={() => checkPNR()} disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Check
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary card */}
          <div className="card overflow-hidden">
            <div className="bg-navy-600 px-6 py-4 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide">PNR Number</p>
                  <p className="font-mono text-2xl font-bold tracking-widest">{result.pnr}</p>
                </div>
                <StatusBadge status={result.status} />
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{formatTime(result.departure_time)}</p>
                  <p className="text-xs font-bold text-navy-600">{result.source_station}</p>
                </div>
                <div className="flex flex-1 flex-col items-center gap-1">
                  <Train className="h-4 w-4 text-slate-400" />
                  <div className="h-px w-full bg-slate-200" />
                  <p className="text-xs text-slate-500">{result.train_name}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{formatTime(result.arrival_time)}</p>
                  <p className="text-xs font-bold text-navy-600">{result.destination_station}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-100 pt-5 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Train</p>
                  <p className="font-medium">{result.train_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Journey date</p>
                  <p className="font-medium">{formatDate(result.journey_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Amount paid</p>
                  <p className="font-medium">{formatAmount(result.total_amount)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Passengers */}
          <div className="card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Users className="h-4 w-4" /> Passengers ({result.passengers.length})
            </h3>
            <div className="space-y-3">
              {result.passengers.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{p.full_name}</p>
                    <p className="text-xs text-slate-500">Age {p.age} · {p.gender}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={p.status} />
                    {p.seat_number && (
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {p.coach_number} · Berth {p.seat_number}
                      </p>
                    )}
                    {p.waitlist_number && (
                      <p className="mt-1 text-xs text-orange-600">WL/{p.waitlist_number}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
