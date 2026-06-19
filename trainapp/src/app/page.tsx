import Link from 'next/link'
import { ArrowRight, Shield, Zap, Clock } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-600 px-4 pt-20 pb-28 text-white">
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Live seat availability · Instant booking
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Book train tickets
            <br />
            <span className="text-amber-400">across India</span>
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-base text-white/70">
            Search trains, check seat availability, and book tickets in seconds.
            Powered by real-time seat data.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 active:scale-[0.98]"
          >
            Search trains <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── PNR card — overlaps hero bottom ────────────────────────────── */}
      <div className="relative z-10 mx-auto w-full max-w-md -mt-[52px] px-4">
        <div className="card p-5 shadow-xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Check PNR status
          </p>
          <form action="/pnr" method="get" className="flex gap-2">
            <input
              name="pnr"
              type="text"
              placeholder="Enter 10-digit PNR number"
              maxLength={10}
              pattern="[0-9]{10}"
              className="input flex-1 font-mono tracking-widest"
            />
            <button type="submit" className="btn-primary shrink-0">Check</button>
          </form>
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="mx-auto mt-14 w-full max-w-6xl px-4 pb-20">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: Zap,
              title: 'Real-time availability',
              desc: 'Seat counts updated live via Redis cache. What you see is always accurate.',
            },
            {
              icon: Shield,
              title: 'Safe retries',
              desc: 'Idempotency keys mean no duplicate bookings if your connection drops mid-request.',
            },
            {
              icon: Clock,
              title: 'Auto waitlist promotion',
              desc: 'Cancellations automatically promote RAC and waitlist passengers in the background.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Icon className="h-5 w-5 text-navy-600" />
              </div>
              <h3 className="mb-1.5 font-semibold text-slate-900">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
