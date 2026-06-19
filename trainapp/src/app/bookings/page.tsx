'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Ticket, ChevronRight, Search } from 'lucide-react'
import { bookingsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import type { BookingResponse, BookingStatusEnum } from '@/types'
import { formatDate, formatTime, formatAmount, CLASS_LABELS } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { cn } from '@/lib/utils'

const FILTERS: { label: string; value: string }[] = [
  { label: 'All',       value: ''          },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'RAC',       value: 'RAC'       },
  { label: 'Waitlist',  value: 'WAITING'   },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export default function BookingsPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [bookings, setBookings] = useState<BookingResponse[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('')

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return }
    load()
  }, [token, filter])

  async function load() {
    setLoading(true)
    try {
      const data = await bookingsApi.list(token!, filter || undefined)
      setBookings(data)
    } catch {}
    finally { setLoading(false) }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My bookings</h1>
        <Link href="/search" className="btn-primary py-2 text-xs">
          <Search className="h-3.5 w-3.5" /> New search
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition',
              filter === f.value
                ? 'border-navy-600 bg-navy-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Ticket className="mb-4 h-12 w-12 text-slate-200" />
          <p className="text-base font-medium text-slate-600">No bookings found</p>
          <p className="mt-1 text-sm text-slate-400">Your bookings will appear here once you book a ticket.</p>
          <Link href="/search" className="btn-primary mt-6">Search trains</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className="card flex items-center gap-4 p-4 transition hover:shadow-md hover:border-navy-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-slate-900 truncate">{b.train.train_name}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-xs text-slate-500 font-mono">PNR: {b.pnr}</p>
                <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                  <span>{b.source_station.code}</span>
                  <span className="text-slate-300">→</span>
                  <span>{b.destination_station.code}</span>
                  <span className="text-slate-300">·</span>
                  <span>{formatDate(b.journey_date)}</span>
                  <span className="text-slate-300">·</span>
                  <span>{CLASS_LABELS[b.seat_class.class_type]}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-900">{formatAmount(b.total_amount)}</p>
                <p className="text-xs text-slate-400">{b.passengers.length} pax</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
