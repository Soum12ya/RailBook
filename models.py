"""
models.py — SQLAlchemy ORM models (Level 1)

Database schema:
  users ──< bookings >── trains ──< seat_classes
                          │
                     train_stops >── stations
  bookings ──< passengers

Every table uses a UUID string primary key (portable, no auto-increment
collisions when we later shard in Level 5).
"""

import uuid
import random
import enum
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey,
    Boolean, Enum, Date, Float, JSON, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ─── helpers ────────────────────────────────────────────────────────────────

def _uuid() -> str:
    return str(uuid.uuid4())


def _pnr() -> str:
    """Generate a 10-digit numeric PNR like IRCTC does."""
    return "".join([str(random.randint(0, 9)) for _ in range(10)])


# ─── enums ──────────────────────────────────────────────────────────────────

class GenderEnum(str, enum.Enum):
    M = "M"
    F = "F"
    T = "T"


class SeatClassEnum(str, enum.Enum):
    SL = "SL"    # Sleeper Class
    AC3 = "3A"   # Third AC
    AC2 = "2A"   # Second AC
    AC1 = "1A"   # First AC
    CC = "CC"    # Chair Car
    EC = "EC"    # Executive Chair Car
    GN = "GN"    # General / Unreserved


class BerthPrefEnum(str, enum.Enum):
    LB = "LB"   # Lower Berth
    MB = "MB"   # Middle Berth
    UB = "UB"   # Upper Berth
    SL = "SL"   # Side Lower
    SU = "SU"   # Side Upper
    NO = "NO"   # No Preference


class BookingStatusEnum(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    RAC = "RAC"           # Reservation Against Cancellation
    WAITING = "WAITING"   # Waitlisted
    CANCELLED = "CANCELLED"


class PaymentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


# ─── models ─────────────────────────────────────────────────────────────────

class User(Base):
    """
    Registered user. Passwords are stored hashed (bcrypt) — never plain text.
    is_admin flag gates the admin-only endpoints.
    """
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    bookings = relationship("Booking", back_populates="user")


class Station(Base):
    """
    Railway station. 'code' is the Indian Railways station code (e.g. NDLS,
    CSTM, MAS). Indexed because train searches always filter by station code.
    """
    __tablename__ = "stations"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String(10), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    zone = Column(String(10), nullable=True)   # NR, SR, WR, ER, …

    source_trains = relationship(
        "Train", foreign_keys="Train.source_station_id", back_populates="source_station"
    )
    dest_trains = relationship(
        "Train", foreign_keys="Train.destination_station_id", back_populates="destination_station"
    )
    stops = relationship("TrainStop", back_populates="station")


class Train(Base):
    """
    A train. days_of_week is a JSON array of integers (Mon=0 … Sun=6),
    e.g. [0, 3, 5] means the train runs Monday, Thursday, Saturday.
    """
    __tablename__ = "trains"

    id = Column(String, primary_key=True, default=_uuid)
    train_number = Column(String(10), unique=True, nullable=False, index=True)
    train_name = Column(String(255), nullable=False)
    source_station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    destination_station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    departure_time = Column(String(5), nullable=False)   # "06:30"
    arrival_time = Column(String(5), nullable=False)     # "22:45"
    duration_mins = Column(Integer, nullable=False)      # total journey minutes
    days_of_week = Column(JSON, nullable=False)          # [0, 1, 2, 3, 4, 5, 6]
    total_distance_km = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source_station = relationship(
        "Station", foreign_keys=[source_station_id], back_populates="source_trains"
    )
    destination_station = relationship(
        "Station", foreign_keys=[destination_station_id], back_populates="dest_trains"
    )
    stops = relationship("TrainStop", back_populates="train", order_by="TrainStop.stop_order")
    seat_classes = relationship("SeatClass", back_populates="train")
    bookings = relationship("Booking", back_populates="train")


class TrainStop(Base):
    """
    Intermediate stops of a train in order (stop_order 1 = source, last = dest).
    Used for partial-journey bookings (boarding at an intermediate station).
    """
    __tablename__ = "train_stops"
    __table_args__ = (
        UniqueConstraint("train_id", "stop_order", name="uq_train_stop_order"),
        UniqueConstraint("train_id", "station_id", name="uq_train_station"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    train_id = Column(String, ForeignKey("trains.id", ondelete="CASCADE"), nullable=False)
    station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    stop_order = Column(Integer, nullable=False)     # 1, 2, 3, …
    arrival_time = Column(String(5), nullable=True)   # null for origin
    departure_time = Column(String(5), nullable=True) # null for destination
    distance_km = Column(Integer, default=0)          # cumulative from origin

    train = relationship("Train", back_populates="stops")
    station = relationship("Station", back_populates="stops")


class SeatClass(Base):
    """
    A seat class (SL, 3A, 2A, …) on a specific train.
    available_seats is the live count — decremented on booking, incremented on
    cancellation.

    ⚠️  Level 1 WARNING: decrementing available_seats without a database lock
    can cause DOUBLE BOOKING under concurrent requests. This is intentional at
    Level 1 so you see the problem. Level 2 fixes it with SELECT FOR UPDATE.

    RAC (Reservation Against Cancellation):
      RAC passengers share a berth (side-lower) and get a full berth if any
      confirmed passenger cancels. rac_seats holds how many RAC slots exist.

    Waitlist:
      Beyond RAC, passengers go to WL-1, WL-2, … up to waitlist_quota.
    """
    __tablename__ = "seat_classes"
    __table_args__ = (
        UniqueConstraint("train_id", "class_type", name="uq_train_class"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    train_id = Column(String, ForeignKey("trains.id", ondelete="CASCADE"), nullable=False)
    class_type = Column(Enum(SeatClassEnum), nullable=False)
    total_seats = Column(Integer, nullable=False)
    available_seats = Column(Integer, nullable=False)    # confirmed quota
    rac_seats = Column(Integer, default=0)               # RAC quota
    rac_available = Column(Integer, default=0)           # remaining RAC
    waitlist_quota = Column(Integer, default=50)
    current_waitlist = Column(Integer, default=0)
    base_fare_per_km = Column(Float, nullable=False)     # INR per km

    train = relationship("Train", back_populates="seat_classes")
    bookings = relationship("Booking", back_populates="seat_class")


class Booking(Base):
    """
    One booking = one PNR = one or more passengers travelling together.
    All passengers in a booking share the same train, date, class, and
    source-destination pair.
    """
    __tablename__ = "bookings"

    id = Column(String, primary_key=True, default=_uuid)
    pnr = Column(String(10), unique=True, nullable=False, index=True, default=_pnr)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    train_id = Column(String, ForeignKey("trains.id"), nullable=False)
    seat_class_id = Column(String, ForeignKey("seat_classes.id"), nullable=False)
    source_station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    destination_station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    journey_date = Column(Date, nullable=False)
    status = Column(Enum(BookingStatusEnum), default=BookingStatusEnum.CONFIRMED, nullable=False)
    total_amount = Column(Float, nullable=False)
    payment_status = Column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING)
    transaction_id = Column(String, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    
    idempotency_key = Column(String, unique=True, nullable=True, index=True)
    refund_amount = Column(Float, nullable=True, default=0.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="bookings")
    train = relationship("Train", back_populates="bookings")
    seat_class = relationship("SeatClass", back_populates="bookings")
    passengers = relationship("Passenger", back_populates="booking", cascade="all, delete-orphan")
    source_station = relationship("Station", foreign_keys=[source_station_id])
    destination_station = relationship("Station", foreign_keys=[destination_station_id])


class Passenger(Base):
    """
    Individual passenger within a booking.
    seat_number and coach_number are assigned by the allotment system
    (simplified at Level 1 — we just assign auto-incremented seat numbers).
    """
    __tablename__ = "passengers"

    id = Column(String, primary_key=True, default=_uuid)
    booking_id = Column(String, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    full_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(Enum(GenderEnum), nullable=False)
    berth_preference = Column(Enum(BerthPrefEnum), default=BerthPrefEnum.NO)
    seat_number = Column(String(10), nullable=True)    # e.g. "B2-34"
    coach_number = Column(String(10), nullable=True)   # e.g. "B2"
    status = Column(Enum(BookingStatusEnum), default=BookingStatusEnum.CONFIRMED)
    waitlist_number = Column(Integer, nullable=True)   # WL-1, WL-2, …

    booking = relationship("Booking", back_populates="passengers")