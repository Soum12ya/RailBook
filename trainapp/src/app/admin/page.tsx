'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Train, MapPin, Ticket, ArrowRight, Activity } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { adminApi } from '@/lib/adminApi'

export default function AdminOverview() {
  const { token } = useAuthStore()
  const [counts, setCounts] = useState({ trains: 0, stations: 0 })
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    if (!token) return
    adminApi.listTrains(token).then(d => setCounts(c => ({ ...c, trains: d.length }))).catch(() => {})
    adminApi.listStations(token).then(d => setCounts(c => ({ ...c, stations: d.length }))).catch(() => {})
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/health`)
      .then(r => r.json()).then(setHealth).catch(() => {})
  }, [token])

  const cards = [
    { label: 'Total trains',   value: counts.trains,   icon: Train,   href: '/admin/trains',   color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Total stations', value: counts.stations, icon: MapPin,  href: '/admin/stations', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Manage bookings',value: 'View →',        icon: Ticket,  href: '/admin/bookings', color: 'text-purple-600',  bg: 'bg-purple-50' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">Manage trains, stations, and monitor bookings.</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, href, color, bg }) => (
          <Link key={href} href={href} className="card flex items-center gap-4 p-5 transition hover:shadow-md hover:border-slate-300">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-sm text-slate-500 truncate">{label}</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>

      {/* System health */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">System health</h2>
        </div>
        {health ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'API',           ok: true },
              { label: 'Redis',         ok: health.services?.redis },
              { label: 'Elasticsearch', ok: health.services?.elasticsearch },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  {ok ? 'Online' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Checking services…</p>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/trains" className="card flex items-center justify-between p-4 transition hover:border-navy-300 hover:bg-navy-50 group">
          <div>
            <p className="font-medium text-slate-900 group-hover:text-navy-700">Add a new train</p>
            <p className="text-xs text-slate-400 mt-0.5">Set schedule, stops, classes and fares</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-navy-500" />
        </Link>
        <Link href="/admin/stations" className="card flex items-center justify-between p-4 transition hover:border-navy-300 hover:bg-navy-50 group">
          <div>
            <p className="font-medium text-slate-900 group-hover:text-navy-700">Add a new station</p>
            <p className="text-xs text-slate-400 mt-0.5">Register station code, city, zone</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-navy-500" />
        </Link>
      </div>
    </div>
  )
}
