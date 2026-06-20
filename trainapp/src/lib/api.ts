import type {
  Token, UserCreate, BookingCreate, BookingResponse,
  PNRStatusResponse, TrainAvailability, TrainSearchRequest,
  StationResponse, ESTrainResult,
} from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Core fetch helper ──────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {}
    throw new Error(detail)
  }
  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: UserCreate) =>
    apiFetch<Token>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password })
    return fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }).then(async r => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.detail || 'Login failed')
      }
      return r.json() as Promise<Token>
    })
  },

  logout: (token: string) =>
    apiFetch('/auth/logout', { method: 'POST' }, token),

  me: (token: string) =>
    apiFetch('/auth/me', {}, token),
}

// ── Stations ───────────────────────────────────────────────────────────────
export const stationsApi = {
  list: (search?: string) =>
    apiFetch<StationResponse[]>(`/stations${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  searchES: (q: string) =>
    apiFetch<{ code: string; name: string; city: string; state: string }[]>(
      `/stations/search?q=${encodeURIComponent(q)}&limit=8`
    ),
}

// ── Trains ─────────────────────────────────────────────────────────────────
export const trainsApi = {
  search: (data: TrainSearchRequest) =>
    apiFetch<TrainAvailability[]>('/trains/search', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  searchES: (q: string) =>
    apiFetch<ESTrainResult[]>(`/trains/search?q=${encodeURIComponent(q)}&limit=10`),

  get: (trainId: string) =>
    apiFetch<{ id: string; train_number: string; train_name: string }>(`/trains/${trainId}`),
}

// ── Bookings ───────────────────────────────────────────────────────────────
export const bookingsApi = {
  create: (data: BookingCreate, token: string, idempotencyKey?: string) => {
    const headers: Record<string, string> = {}
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey
    return apiFetch<BookingResponse>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    }, token)
  },

  list: (token: string, status?: string) =>
    apiFetch<BookingResponse[]>(
      `/bookings${status ? `?status=${status}` : ''}`,
      {},
      token,
    ),

  get: (id: string, token: string) =>
    apiFetch<BookingResponse>(`/bookings/${id}`, {}, token),

  cancel: (id: string, token: string, reason = 'Cancelled by user') =>
    apiFetch<BookingResponse>(`/bookings/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }, token),

  confirmPayment: (id: string, token: string, transactionId: string) =>
    apiFetch<BookingResponse>(
      `/bookings/${id}/payment?transaction_id=${encodeURIComponent(transactionId)}`,
      { method: 'PUT' },
      token,
    ),

  pnr: (pnr: string) =>
    apiFetch<PNRStatusResponse>(`/bookings/pnr/${pnr}`),
}
