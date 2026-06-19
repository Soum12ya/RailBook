'use client'
import { Trash2, Plus, User } from 'lucide-react'
import type { PassengerCreate } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  passengers: PassengerCreate[]
  onChange: (passengers: PassengerCreate[]) => void
}

const empty = (): PassengerCreate => ({
  full_name: '', age: 0, gender: 'M', berth_preference: 'NO',
})

export default function PassengerForm({ passengers, onChange }: Props) {
  function update(i: number, field: keyof PassengerCreate, value: string | number) {
    const next = [...passengers]
    next[i] = { ...next[i], [field]: value }
    onChange(next)
  }

  function remove(i: number) {
    onChange(passengers.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-4">
      {passengers.map((p, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <User className="h-4 w-4 text-slate-400" />
              Passenger {i + 1}
            </div>
            {passengers.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Full name</label>
              <input
                type="text"
                value={p.full_name}
                onChange={e => update(i, 'full_name', e.target.value)}
                placeholder="As on ID proof"
                className="input"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Age</label>
              <input
                type="number"
                value={p.age || ''}
                onChange={e => update(i, 'age', parseInt(e.target.value) || 0)}
                placeholder="Age"
                min={1} max={120}
                className="input"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Gender</label>
              <select value={p.gender} onChange={e => update(i, 'gender', e.target.value)} className="input">
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="T">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Berth preference</label>
              <select value={p.berth_preference} onChange={e => update(i, 'berth_preference', e.target.value)} className="input">
                <option value="NO">No preference</option>
                <option value="LB">Lower</option>
                <option value="MB">Middle</option>
                <option value="UB">Upper</option>
                <option value="SL">Side Lower</option>
                <option value="SU">Side Upper</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      {passengers.length < 6 && (
        <button
          type="button"
          onClick={() => onChange([...passengers, empty()])}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm text-slate-500 transition hover:border-navy-400 hover:text-navy-600"
        >
          <Plus className="h-4 w-4" /> Add passenger
        </button>
      )}
    </div>
  )
}
