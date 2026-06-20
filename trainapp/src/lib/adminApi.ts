/**
 * Admin API — uses only endpoints that actually exist in your Level 1-3 backend.
 *
 * Real endpoints available:
 *   GET  /stations                  list/search all stations
 *   POST /stations                  create station (admin)
 *   GET  /trains/{id}               get one train by UUID
 *   POST /trains                    create train (admin)
 *   POST /trains/search             search trains src→dest→date
 *   PUT  /trains/{id}/status        toggle active/inactive (admin)
 *   GET  /bookings                  current user's bookings (user-scoped)
 *   GET  /bookings/pnr/{pnr}        public PNR lookup
 *   GET  /stations?search=X         filter stations by code/name/city
 */

import type { StationResponse, TrainResponse, BookingResponse } from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function adminFetch<T>(
  path: string,
  options: RequestInit = {},
  token: string,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Stations ─────────────────────────────────────────────────────────────────
export const adminApi = {
  listStations: (token: string) =>
    adminFetch<StationResponse[]>('/stations', {}, token),

  createStation: (
    token: string,
    data: { code: string; name: string; city: string; state: string; zone?: string },
  ) =>
    adminFetch<StationResponse>(
      '/stations',
      { method: 'POST', body: JSON.stringify(data) },
      token,
    ),

  // ── Trains ────────────────────────────────────────────────────────────────
  // Your backend has no "list all trains" endpoint.
  // Strategy: pick every station pair where src < dest alphabetically (avoids
  // duplicates), run POST /trains/search for today, collect unique train_ids,
  // then GET /trains/{id} for each to get the full TrainResponse with seat classes.
  listTrains: async (token: string): Promise<TrainResponse[]> => {
    const today = new Date().toISOString().split('T')[0]

    // 1. Get all stations
    const stations = await adminFetch<StationResponse[]>('/stations', {}, token)
    if (stations.length === 0) return []

    // 2. Search each unique ordered pair (not both directions, saves requests)
    const seen = new Set<string>()
    const fullTrains: TrainResponse[] = []

    // Run all searches in parallel — with 10 stations that's ~45 pairs, fine
    const searches = await Promise.allSettled(
      stations.flatMap((src, i) =>
        stations.slice(i + 1).map(dest =>
          adminFetch<{ train_id: string }[]>(
            '/trains/search',
            {
              method: 'POST',
              body: JSON.stringify({
                source_station_code: src.code,
                destination_station_code: dest.code,
                journey_date: today,
              }),
            },
            token,
          ).catch(() => [] as { train_id: string }[]),
        ),
      ),
    )

    // 3. Collect unique train IDs
    const idsToFetch: string[] = []
    for (const r of searches) {
      if (r.status === 'fulfilled') {
        for (const t of r.value) {
          if (t.train_id && !seen.has(t.train_id)) {
            seen.add(t.train_id)
            idsToFetch.push(t.train_id)
          }
        }
      }
    }

    // 4. Fetch full TrainResponse for each unique train (in parallel)
    const fullResults = await Promise.allSettled(
      idsToFetch.map(id =>
        adminFetch<TrainResponse>(`/trains/${id}`, {}, token),
      ),
    )
    for (const r of fullResults) {
      if (r.status === 'fulfilled') fullTrains.push(r.value)
    }

    // Sort by train number
    fullTrains.sort((a, b) => a.train_number.localeCompare(b.train_number))
    return fullTrains
  },

  getTrain: (token: string, id: string) =>
    adminFetch<TrainResponse>(`/trains/${id}`, {}, token),

  createTrain: (token: string, data: object) =>
    adminFetch<TrainResponse>(
      '/trains',
      { method: 'POST', body: JSON.stringify(data) },
      token,
    ),

  setTrainStatus: (token: string, id: string, is_active: boolean) =>
    adminFetch(
      `/trains/${id}/status?is_active=${is_active}`,
      { method: 'PUT' },
      token,
    ),

  // ── Bookings ──────────────────────────────────────────────────────────────
  // GET /bookings is user-scoped — returns only the logged-in user's bookings.
  // To see ALL users' bookings you need one new backend endpoint (shown below).
  //
  // ─── ADD THIS TO routers/bookings.py ─────────────────────────────────────
  //
  //   from routers.auth import get_current_admin
  //
  //   @router.get('/admin/all', response_model=List[BookingResponse])
  //   def all_bookings(
  //       status_filter: BookingStatusEnum = Query(None, alias='status'),
  //       db: Session = Depends(get_db),
  //       _: User = Depends(get_current_admin),
  //   ):
  //       """Admin-only: list every booking in the system."""
  //       q = db.query(Booking)
  //       if status_filter:
  //           q = q.filter(Booking.status == status_filter)
  //       return q.order_by(Booking.created_at.desc()).limit(500).all()
  //
  // Once added, change the URL in listAllBookings from '/bookings' to '/bookings/admin/all'
  // ─────────────────────────────────────────────────────────────────────────

  listAllBookings: (token: string, status?: string) =>
    adminFetch<BookingResponse[]>(
      // Change to '/bookings/admin/all' after adding the backend endpoint above
      `/bookings${status ? `?status=${status}` : ''}`,
      {},
      token,
    ),
}
