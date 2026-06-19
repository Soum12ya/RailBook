'use client'
import { Clock, Calendar, ArrowRight, AlertCircle } from 'lucide-react'
import { formatDuration, formatTime, runsDays, CLASS_LABELS, formatAmount, cn } from '@/lib/utils'
import type { TrainAvailability, SeatClassEnum } from '@/types'

interface Props {
  train: TrainAvailability
  journeyDate: string
  onBook: (train: TrainAvailability, classId: string, classType: SeatClassEnum) => void
}

export default function TrainCard({ train, journeyDate, onBook }: Props) {
  const hasSeats = train.available_classes.some(c => c.available_seats > 0 || c.rac_available > 0)

  return (
    <div className={cn('card p-0 overflow-hidden transition hover:shadow-md', !train.runs_on_date && 'opacity-60')}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
        <div>
          <span className="font-mono text-xs font-medium text-slate-500">{train.train_number}</span>
          <h3 className="text-base font-semibold text-slate-900">{train.train_name}</h3>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-xl font-bold text-navy-600">{formatTime(train.departure_time)}</div>
            <div className="text-xs text-slate-500">{train.source_station}</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" /> {formatDuration(train.duration_mins)}
            </div>
            <div className="flex items-center gap-1">
              <div className="h-px w-10 bg-slate-300" />
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <div className="h-px w-10 bg-slate-300" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-navy-600">{formatTime(train.arrival_time)}</div>
            <div className="text-xs text-slate-500">{train.destination_station}</div>
          </div>
        </div>
      </div>

      {/* Runs on day warning */}
      {!train.runs_on_date && (
        <div className="flex items-center gap-2 bg-orange-50 px-5 py-2 text-xs text-orange-700">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          This train does not run on the selected date. Runs on: {runsDays(train.days_of_week)}
        </div>
      )}

      {/* Classes */}
      <div className="flex flex-wrap gap-2 px-5 py-4">
        {train.available_classes.map(cls => {
          const soldOut = cls.available_seats === 0 && cls.rac_available === 0
          const isWL = cls.available_seats === 0 && cls.rac_available === 0 && cls.current_waitlist < cls.waitlist_quota
          const fare = cls.base_fare_per_km * 200 // rough display fare for 200km

          return (
            <button
              key={cls.id}
              onClick={() => !soldOut && train.runs_on_date && onBook(train, cls.id, cls.class_type)}
              disabled={soldOut || !train.runs_on_date}
              className={cn(
                'flex flex-col items-start rounded-lg border px-3.5 py-2.5 text-left transition',
                soldOut
                  ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                  : 'border-slate-200 hover:border-navy-600 hover:bg-navy-50 cursor-pointer active:scale-[0.98]',
              )}
            >
              <span className="text-xs font-semibold text-navy-600">{CLASS_LABELS[cls.class_type]}</span>
              <span className="mt-0.5 text-[10px] font-mono text-slate-400">{cls.class_type}</span>
              {soldOut ? (
                <span className="mt-1.5 text-xs font-medium text-red-500">Not available</span>
              ) : (
                <>
                  <span className="mt-1.5 text-sm font-bold text-slate-900">
                    {cls.available_seats > 0 ? `${cls.available_seats} avail` : `RAC ${cls.rac_available}`}
                  </span>
                  {cls.current_waitlist > 0 && (
                    <span className="text-[10px] text-orange-600">WL {cls.current_waitlist}</span>
                  )}
                </>
              )}
            </button>
          )
        })}
        {train.available_classes.length === 0 && (
          <p className="text-sm text-slate-400">No classes available for this route.</p>
        )}
      </div>
    </div>
  )
}
