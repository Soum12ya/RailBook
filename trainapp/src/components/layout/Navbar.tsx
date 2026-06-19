'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Train, User, LogOut, Menu, X, Search, Ticket } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/search',   label: 'Search Trains', icon: Search },
  { href: '/pnr',      label: 'PNR Status',    icon: Ticket },
  { href: '/bookings', label: 'My Bookings',   icon: Ticket, auth: true },
  { href: '/admin',    label: 'Admin',         icon: User,   admin: true },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { token, user, clearAuth } = useAuthStore()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    try {
      if (token) await authApi.logout(token)
    } catch {}
    clearAuth()
    toast.success('Logged out')
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-navy-600">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-600">
            <Train className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg">RailBook</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.filter(n => (!n.auth || token) && (!n.admin || user?.is_admin)).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                pathname === href
                  ? 'bg-navy-50 text-navy-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth */}
        <div className="hidden items-center gap-3 md:flex">
          {token ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-600 text-xs font-bold text-white">
                  {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="text-slate-700">{user?.full_name?.split(' ')[0]}</span>
              </div>
              <button onClick={handleLogout} className="btn-secondary py-1.5 text-xs">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="btn-secondary py-2">Sign in</Link>
              <Link href="/auth/register" className="btn-primary py-2">Sign up free</Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 md:hidden animate-fade-in">
          <nav className="flex flex-col gap-1 pt-2">
            {NAV.filter(n => (!n.auth || token) && (!n.admin || user?.is_admin)).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium',
                  pathname === href ? 'bg-navy-50 text-navy-600' : 'text-slate-600',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-slate-100">
              {token ? (
                <button onClick={handleLogout} className="btn-secondary justify-start">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <>
                  <Link href="/auth/login" onClick={() => setOpen(false)} className="btn-secondary">Sign in</Link>
                  <Link href="/auth/register" onClick={() => setOpen(false)} className="btn-primary">Sign up free</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
