'use client'
import { useEffect, useState } from 'react'
import { Loader2, Search, X, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { adminApi } from '@/lib/adminApi'
import type { BookingResponse } from '@/types'
import { formatDate, formatAmount, CLASS_LABELS } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'

const FILTERS = [
  { label: 'All',       value: ''          },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'RAC',       value: 'RAC'       },
  { label: 'Waitlist',  value: 'WAITING'   },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export default function AdminBookings() {
  const { token } = useAuthStore()
  const [bookings, setBookings] = useState<BookingResponse[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('')
  const [query,    setQuery]    = useState('')
  // This becomes false once you add GET /bookings/admin/all to your backend
  const needsBackendFix = true

  useEffect(() => { if (token) load() }, [token, filter])

  async function load() {
    setLoading(true)
    try {
      const data = await adminApi.listAllBookings(token!, filter || undefined)
      setBookings(data)
    } catch {}
    finally { setLoading(false) }
  }

  const filtered = bookings.filter(b =>
    b.pnr.includes(query) ||
    b.train.train_number.includes(query) ||
    b.train.train_name.toLowerCase().includes(query.toLowerCase()) ||
    b.passengers.some(p => p.full_name.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">All Bookings</h1>
        <p className="text-sm text-slate-500 mt-0.5">{bookings.length} bookings loaded</p>
      </div>

      {/* Backend fix required banner */}
      {needsBackendFix && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Showing only admin's own bookings</p>
            <p className="mt-0.5 text-amber-700">
              To see <strong>all users' bookings</strong>, add{' '}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
                GET /bookings/admin/all
              </code>{' '}
              to your backend. See{' '}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
                BACKEND_FIXES_REQUIRED.md
              </code>{' '}
              in the project root for the exact code to add.
            </p>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              filter === f.value
                ? 'border-navy-600 bg-navy-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card mb-5 flex items-center gap-2 px-4 py-2.5">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by PNR, train, or passenger name…"
          className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600 transition">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3.5">PNR</th>
                <th className="px-5 py-3.5">Train</th>
                <th className="px-5 py-3.5">Route</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Class</th>
                <th className="px-5 py-3.5 text-center">Pax</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(b => (
                <tr
                  key={b.id}
                  className="cursor-pointer transition hover:bg-slate-50"
                  onClick={() => window.open(`/bookings/${b.id}`, '_blank')}
                >
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold text-navy-700">
                    {b.pnr}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="max-w-[160px] truncate font-medium text-slate-900">
                      {b.train.train_name}
                    </div>
                    <div className="font-mono text-xs text-slate-400">{b.train.train_number}</div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {b.source_station.code} → {b.destination_station.code}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                    {formatDate(b.journey_date)}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {CLASS_LABELS[b.seat_class.class_type]}
                  </td>
                  <td className="px-5 py-3.5 text-center text-slate-600">
                    {b.passengers.length}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-900">
                    {formatAmount(b.total_amount)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    No bookings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
