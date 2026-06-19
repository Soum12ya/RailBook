'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Train, MapPin, Ticket, LogOut, ChevronRight, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const NAV = [
  { href: '/admin',          label: 'Overview',  icon: LayoutDashboard, exact: true },
  { href: '/admin/trains',   label: 'Trains',    icon: Train },
  { href: '/admin/stations', label: 'Stations',  icon: MapPin },
  { href: '/admin/bookings', label: 'All Bookings', icon: Ticket },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { token, user, clearAuth } = useAuthStore()

  useEffect(() => {
    if (!token)          { router.replace('/auth/login'); return }
    if (!user?.is_admin) { router.replace('/'); toast.error('Admin access required') }
  }, [token, user])

  async function logout() {
    try { if (token) await authApi.logout(token) } catch {}
    clearAuth()
    router.push('/')
  }

  if (!token || !user?.is_admin) return null

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-600">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">Admin panel</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-navy-50 text-navy-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 px-3 py-1.5">
            <p className="text-xs font-medium text-slate-700">{user.full_name}</p>
            <p className="text-[11px] text-slate-400">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-slate-50 p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
