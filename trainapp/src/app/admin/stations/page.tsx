'use client'
import { useEffect, useState } from 'react'
import { Plus, Loader2, MapPin, X, Search } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { adminApi } from '@/lib/adminApi'
import type { StationResponse } from '@/types'
import toast from 'react-hot-toast'

const ZONES = ['NR','WR','CR','SR','ER','NER','ECR','NCR','NWR','WCR','SWR','SCR','SER','ECoR','NFR']

export default function AdminStations() {
  const { token } = useAuthStore()
  const [stations, setStations] = useState<StationResponse[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({ code: '', name: '', city: '', state: '', zone: '' })

  useEffect(() => { if (token) load() }, [token])

  async function load() {
    setLoading(true)
    try { setStations(await adminApi.listStations(token!)) }
    catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function upd(f: string, v: string) { setForm(x => ({ ...x, [f]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code || !form.name || !form.city || !form.state) {
      toast.error('Fill in all required fields'); return
    }
    setSaving(true)
    try {
      await adminApi.createStation(token!, {
        ...form,
        code: form.code.toUpperCase(),
        zone: form.zone || undefined,
      })
      toast.success(`Station ${form.code.toUpperCase()} created`)
      setShowForm(false)
      setForm({ code: '', name: '', city: '', state: '', zone: '' })
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const filtered = stations.filter(s =>
    s.code.includes(query.toUpperCase()) ||
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.city.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stations</h1>
          <p className="text-sm text-slate-500 mt-0.5">{stations.length} stations registered</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add station
        </button>
      </div>

      {/* Search bar */}
      <div className="card mb-5 flex items-center gap-2 px-4 py-2.5">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search by code, name or city…"
          className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400"
        />
        {query && <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">City</th>
                <th className="px-5 py-3.5">State</th>
                <th className="px-5 py-3.5">Zone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-navy-600 px-2 py-0.5 font-mono text-xs font-bold text-white">{s.code}</span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-900">{s.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{s.city}</td>
                  <td className="px-5 py-3.5 text-slate-500">{s.state}</td>
                  <td className="px-5 py-3.5 text-slate-400">{s.zone || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-16 text-center text-slate-400">No stations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add station modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-slide-up">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50">
                  <MapPin className="h-4 w-4 text-navy-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Add station</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Station code *</label>
                  <input
                    value={form.code}
                    onChange={e => upd('code', e.target.value.toUpperCase())}
                    placeholder="e.g. NDLS"
                    maxLength={8}
                    className="input font-mono font-bold uppercase tracking-widest"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Zone</label>
                  <select value={form.zone} onChange={e => upd('zone', e.target.value)} className="input">
                    <option value="">Select zone</option>
                    {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Station name *</label>
                <input value={form.name} onChange={e => upd('name', e.target.value)}
                  placeholder="e.g. New Delhi Junction" className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">City *</label>
                  <input value={form.city} onChange={e => upd('city', e.target.value)}
                    placeholder="e.g. New Delhi" className="input" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">State *</label>
                  <input value={form.state} onChange={e => upd('state', e.target.value)}
                    placeholder="e.g. Delhi" className="input" required />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Add station'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
