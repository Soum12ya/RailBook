"""
schemas.py — Pydantic v2 schemas for request validation and response serialisation.

Separation of concerns:
  - models.py  → what lives in the database (SQLAlchemy ORM)
  - schemas.py → what comes in/out over HTTP (Pydantic)

This prevents accidentally exposing sensitive fields like hashed_password
and decouples the DB schema from the API contract.
"""

from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from models import (
    GenderEnum, SeatClassEnum, BerthPrefEnum,
    BookingStatusEnum, PaymentStatusEnum,
)


# ─── Auth ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: str

    @field_validator("phone")
    @classmethod
    def phone_must_be_valid(cls, v: str) -> str:
        digits = v.replace("+", "").replace("-", "").replace(" ", "")
        if not digits.isdigit() or len(digits) < 10:
            raise ValueError("Phone must have at least 10 digits")
        return v

    @field_validator("password")
    @classmethod
    def password_strong_enough(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    phone: str
    full_name: str
    is_active: bool
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Stations ───────────────────────────────────────────────────────────────

class StationCreate(BaseModel):
    code: str
    name: str
    city: str
    state: str
    zone: Optional[str] = None

    @field_validator("code")
    @classmethod
    def code_uppercase(cls, v: str) -> str:
        return v.upper().strip()


class StationResponse(BaseModel):
    id: str
    code: str
    name: str
    city: str
    state: str
    zone: Optional[str]

    model_config = {"from_attributes": True}


# ─── Trains ─────────────────────────────────────────────────────────────────

class TrainStopCreate(BaseModel):
    station_code: str   # we look up station by code
    stop_order: int
    arrival_time: Optional[str] = None    # "HH:MM", null for origin
    departure_time: Optional[str] = None  # "HH:MM", null for destination
    distance_km: int = 0


class SeatClassCreate(BaseModel):
    class_type: SeatClassEnum
    total_seats: int
    rac_seats: int = 0
    waitlist_quota: int = 50
    base_fare_per_km: float  # INR per km


class TrainCreate(BaseModel):
    train_number: str
    train_name: str
    source_station_code: str
    destination_station_code: str
    departure_time: str    # "HH:MM"
    arrival_time: str      # "HH:MM"
    duration_mins: int
    total_distance_km: int
    days_of_week: List[int]  # 0=Mon … 6=Sun
    seat_classes: List[SeatClassCreate]
    stops: List[TrainStopCreate]

    @field_validator("days_of_week")
    @classmethod
    def valid_days(cls, v: List[int]) -> List[int]:
        if not v:
            raise ValueError("At least one day of week is required")
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Days of week must be 0-6 (Mon=0, Sun=6)")
        return sorted(set(v))


class SeatClassResponse(BaseModel):
    id: str
    class_type: SeatClassEnum
    total_seats: int
    available_seats: int
    rac_seats: int
    rac_available: int
    current_waitlist: int
    waitlist_quota: int
    base_fare_per_km: float

    model_config = {"from_attributes": True}


class TrainStopResponse(BaseModel):
    stop_order: int
    arrival_time: Optional[str]
    departure_time: Optional[str]
    distance_km: int
    station: StationResponse

    model_config = {"from_attributes": True}


class TrainResponse(BaseModel):
    id: str
    train_number: str
    train_name: str
    departure_time: str
    arrival_time: str
    duration_mins: int
    total_distance_km: int
    days_of_week: List[int]
    is_active: bool
    source_station: StationResponse
    destination_station: StationResponse
    seat_classes: List[SeatClassResponse]

    model_config = {"from_attributes": True}


# ─── Train Search ───────────────────────────────────────────────────────────

class TrainSearchRequest(BaseModel):
    source_station_code: str
    destination_station_code: str
    journey_date: date
    class_type: Optional[SeatClassEnum] = None

    @model_validator(mode="after")
    def date_not_in_past(self) -> "TrainSearchRequest":
        from datetime import date as dt
        if self.journey_date < dt.today():
            raise ValueError("Journey date cannot be in the past")
        return self


class TrainAvailability(BaseModel):
    """Result for one train in a search response."""
    train_id: str
    train_number: str
    train_name: str
    departure_time: str
    arrival_time: str
    duration_mins: int
    source_station: str
    destination_station: str
    runs_on_date: bool
    available_classes: List[SeatClassResponse]

    model_config = {"from_attributes": True}


# ─── Bookings ───────────────────────────────────────────────────────────────

class PassengerCreate(BaseModel):
    full_name: str
    age: int
    gender: GenderEnum
    berth_preference: BerthPrefEnum = BerthPrefEnum.NO

    @field_validator("age")
    @classmethod
    def age_valid(cls, v: int) -> int:
        if v < 1 or v > 120:
            raise ValueError("Age must be between 1 and 120")
        return v


class BookingCreate(BaseModel):
    train_id: str
    seat_class_id: str
    source_station_code: str
    destination_station_code: str
    journey_date: date
    passengers: List[PassengerCreate]

    @field_validator("passengers")
    @classmethod
    def passenger_limit(cls, v: List[PassengerCreate]) -> List[PassengerCreate]:
        if not v:
            raise ValueError("At least one passenger is required")
        if len(v) > 6:
            raise ValueError("Maximum 6 passengers per booking (IRCTC rule)")
        return v

    @model_validator(mode="after")
    def date_not_in_past(self) -> "BookingCreate":
        from datetime import date as dt
        if self.journey_date < dt.today():
            raise ValueError("Journey date cannot be in the past")
        return self


class PassengerResponse(BaseModel):
    id: str
    full_name: str
    age: int
    gender: GenderEnum
    berth_preference: BerthPrefEnum
    seat_number: Optional[str]
    coach_number: Optional[str]
    status: BookingStatusEnum
    waitlist_number: Optional[int]

    model_config = {"from_attributes": True}


class BookingResponse(BaseModel):
    id: str
    pnr: str
    status: BookingStatusEnum
    payment_status: PaymentStatusEnum
    journey_date: date
    total_amount: float
    refund_amount: Optional[float] = None
    created_at: datetime
    train: TrainResponse
    seat_class: SeatClassResponse
    source_station: StationResponse
    destination_station: StationResponse
    passengers: List[PassengerResponse]

    model_config = {"from_attributes": True}


class CancelBookingRequest(BaseModel):
    reason: Optional[str] = "Cancelled by user"


class PNRStatusResponse(BaseModel):
    pnr: str
    status: BookingStatusEnum
    payment_status: PaymentStatusEnum
    journey_date: date
    total_amount: float
    train_number: str
    train_name: str
    departure_time: str
    arrival_time: str
    source_station: str
    destination_station: str
    passengers: List[PassengerResponse]

    model_config = {"from_attributes": True}


# ─── Generic responses ───────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str
