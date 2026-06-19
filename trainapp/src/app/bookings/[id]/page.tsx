'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, Train, Users, CreditCard, AlertTriangle, X, CheckCircle2 } from 'lucide-react'
import { bookingsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import type { BookingResponse } from '@/types'
import { formatDate, formatTime, formatAmount, CLASS_LABELS } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import toast from 'react-hot-toast'

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token } = useAuthStore()
  const [booking, setBooking] = useState<BookingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return }
    load()
  }, [])

  async function load() {
    try {
      const data = await bookingsApi.get(id, token!)
      setBooking(data)
    } catch (err: any) {
      toast.error(err.message)
      router.push('/bookings')
    } finally { setLoading(false) }
  }

  async function handleCancel() {
    if (!token) return
    setCancelling(true)
    try {
      const updated = await bookingsApi.cancel(id, token)
      setBooking(updated)
      setShowCancel(false)
      toast.success(`Booking cancelled. Refund: ${formatAmount(updated.refund_amount || 0)}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally { setCancelling(false) }
  }

  async function handlePay() {
    if (!token) return
    setPaying(true)
    try {
      const txId = `TXN${Date.now()}`
      const updated = await bookingsApi.confirmPayment(id, token, txId)
      setBooking(updated)
      toast.success('Payment confirmed!')
    } catch (err: any) {
      toast.error(err.message)
    } finally { setPaying(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )
  if (!booking) return null

  const isCancelled = booking.status === 'CANCELLED'
  const isPaid = booking.payment_status === 'SUCCESS'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/bookings" className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition">
        <ArrowLeft className="h-4 w-4" /> My bookings
      </Link>

      {/* Hero banner */}
      <div className="mb-5 overflow-hidden rounded-2xl bg-navy-600 text-white">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">PNR Number</p>
              <p className="font-mono text-3xl font-bold tracking-widest">{booking.pnr}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white/10 px-6 py-4">
          <div>
            <p className="text-2xl font-bold">{formatTime(booking.train.departure_time)}</p>
            <p className="text-xs text-white/70">{booking.source_station.code} — {booking.source_station.name}</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <Train className="h-4 w-4 text-white/50" />
            <div className="h-px w-full bg-white/20" />
            <p className="text-xs text-white/60">{booking.train.train_number}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatTime(booking.train.arrival_time)}</p>
            <p className="text-xs text-white/70">{booking.destination_station.code} — {booking.destination_station.name}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-white/10 text-center text-xs">
          {[
            ['Train', `${booking.train.train_name}`],
            ['Date', formatDate(booking.journey_date)],
            ['Class', CLASS_LABELS[booking.seat_class.class_type]],
          ].map(([k, v]) => (
            <div key={k} className="bg-navy-700/50 px-3 py-3">
              <p className="text-white/50">{k}</p>
              <p className="mt-0.5 font-medium truncate">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Passengers */}
      <div className="card mb-4 p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Users className="h-4 w-4" /> Passengers
        </h3>
        <div className="space-y-2">
          {booking.passengers.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{p.full_name}</p>
                <p className="text-xs text-slate-500">Age {p.age} · {p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : 'Other'}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={p.status} />
                {p.coach_number && p.seat_number && (
                  <p className="mt-1 font-mono text-xs text-slate-400">{p.coach_number} · {p.seat_number}</p>
                )}
                {p.waitlist_number && (
                  <p className="mt-1 text-xs text-orange-600">WL/{p.waitlist_number}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment summary */}
      <div className="card mb-6 p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CreditCard className="h-4 w-4" /> Payment
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Fare total</span>
            <span className="font-medium">{formatAmount(booking.total_amount)}</span>
          </div>
          {booking.refund_amount != null && booking.refund_amount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Refund</span>
              <span className="font-medium">{formatAmount(booking.refund_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2">
            <span className="text-slate-500">Payment status</span>
            <span className={`font-medium ${isPaid ? 'text-emerald-600' : booking.payment_status === 'REFUNDED' ? 'text-blue-600' : 'text-amber-600'}`}>
              {booking.payment_status}
            </span>
          </div>
        </div>

        {/* Confirm payment (for PENDING) */}
        {!isCancelled && !isPaid && booking.payment_status === 'PENDING' && (
          <button onClick={handlePay} disabled={paying} className="btn-amber mt-4 w-full">
            {paying ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><CheckCircle2 className="h-4 w-4" /> Confirm payment</>}
          </button>
        )}
      </div>

      {/* Cancel */}
      {!isCancelled && (
        <button
          onClick={() => setShowCancel(true)}
          className="btn-secondary w-full border-red-200 text-red-600 hover:bg-red-50"
        >
          Cancel booking
        </button>
      )}

      {/* Cancel confirm modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-slide-up">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Cancel this booking?</h3>
            <p className="mb-6 text-sm text-slate-500">
              Your refund will be calculated based on how early you cancel before departure.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancel(false)} className="btn-secondary flex-1">Keep booking</button>
              <button onClick={handleCancel} disabled={cancelling} className="flex-1 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50">
                {cancelling ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
