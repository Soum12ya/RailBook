import { type ClassValue, clsx } from 'clsx'
import type { BookingStatusEnum, SeatClassEnum } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(time: string): string {
  // time is HH:MM from backend
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export const CLASS_LABELS: Record<SeatClassEnum, string> = {
  SL:  'Sleeper',
  '3A': 'AC 3 Tier',
  '2A': 'AC 2 Tier',
  '1A': 'AC First',
  CC:  'Chair Car',
  EC:  'Exec Chair',
  GN:  'General',
}

export const STATUS_CONFIG: Record<BookingStatusEnum, { label: string; color: string; bg: string }> = {
  CONFIRMED: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  RAC:       { label: 'RAC',       color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  WAITING:   { label: 'Waitlist',  color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function runsDays(days: number[]): string {
  if (days.length === 7) return 'Daily'
  return days.map(d => DAYS[d]).join(', ')
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
