// ── Enums (must match backend exactly) ────────────────────────────────────
export type SeatClassEnum = 'SL' | '3A' | '2A' | '1A' | 'CC' | 'EC' | 'GN'
export type GenderEnum = 'M' | 'F' | 'T'
export type BerthPrefEnum = 'LB' | 'MB' | 'UB' | 'SL' | 'SU' | 'NO'
export type BookingStatusEnum = 'CONFIRMED' | 'RAC' | 'WAITING' | 'CANCELLED'
export type PaymentStatusEnum = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'

// ── Auth ───────────────────────────────────────────────────────────────────
export interface UserResponse {
  id: string
  email: string
  phone: string
  full_name: string
  is_active: boolean
  is_admin: boolean
  created_at: string
}

export interface Token {
  access_token: string
  token_type: string
  user: UserResponse
}

export interface UserCreate {
  full_name: string
  email: string
  phone: string
  password: string
}

// ── Station ────────────────────────────────────────────────────────────────
export interface StationResponse {
  id: string
  code: string
  name: string
  city: string
  state: string
  zone?: string
}

// ── Train ──────────────────────────────────────────────────────────────────
export interface SeatClassResponse {
  id: string
  class_type: SeatClassEnum
  total_seats: number
  available_seats: number
  rac_seats: number
  rac_available: number
  current_waitlist: number
  waitlist_quota: number
  base_fare_per_km: number
}

export interface TrainResponse {
  id: string
  train_number: string
  train_name: string
  departure_time: string
  arrival_time: string
  duration_mins: number
  total_distance_km: number
  days_of_week: number[]
  is_active: boolean
  source_station: StationResponse
  destination_station: StationResponse
  seat_classes: SeatClassResponse[]
}

export interface TrainAvailability {
  train_id: string
  train_number: string
  train_name: string
  departure_time: string
  arrival_time: string
  duration_mins: number
  source_station: string
  destination_station: string
  runs_on_date: boolean
  available_classes: SeatClassResponse[]
}

export interface TrainSearchRequest {
  source_station_code: string
  destination_station_code: string
  journey_date: string          // YYYY-MM-DD
  class_type?: SeatClassEnum
}

// ── Booking ────────────────────────────────────────────────────────────────
export interface PassengerCreate {
  full_name: string
  age: number
  gender: GenderEnum
  berth_preference: BerthPrefEnum
}

export interface BookingCreate {
  train_id: string
  seat_class_id: string
  source_station_code: string
  destination_station_code: string
  journey_date: string          // YYYY-MM-DD
  passengers: PassengerCreate[]
}

export interface PassengerResponse {
  id: string
  full_name: string
  age: number
  gender: GenderEnum
  berth_preference: BerthPrefEnum
  seat_number?: string
  coach_number?: string
  status: BookingStatusEnum
  waitlist_number?: number
}

export interface BookingResponse {
  id: string
  pnr: string
  status: BookingStatusEnum
  payment_status: PaymentStatusEnum
  journey_date: string
  total_amount: number
  refund_amount?: number
  created_at: string
  train: TrainResponse
  seat_class: SeatClassResponse
  source_station: StationResponse
  destination_station: StationResponse
  passengers: PassengerResponse[]
}

export interface PNRStatusResponse {
  pnr: string
  status: BookingStatusEnum
  payment_status: PaymentStatusEnum
  journey_date: string
  total_amount: number
  train_number: string
  train_name: string
  departure_time: string
  arrival_time: string
  source_station: string
  destination_station: string
  passengers: PassengerResponse[]
}

// ── ES Search ──────────────────────────────────────────────────────────────
export interface ESTrainResult {
  id: string
  train_number: string
  train_name: string
  source_city: string
  source_code: string
  dest_city: string
  dest_code: string
  departure_time: string
  arrival_time: string
  days_of_week: number[]
  is_active: boolean
}

// ── UI helpers ─────────────────────────────────────────────────────────────
export interface SearchFormState {
  from: string
  to: string
  date: string
  classType: SeatClassEnum | ''
}
