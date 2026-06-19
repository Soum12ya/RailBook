"""
routers/bookings.py — Booking endpoints

POST /bookings           → Book a ticket (authenticated)
GET  /bookings           → My booking history
GET  /bookings/pnr/{pnr} → PNR status (public, like IRCTC)
GET  /bookings/{id}      → Get booking details
PUT  /bookings/{id}/cancel → Cancel a booking
PUT  /bookings/{id}/payment → Simulate payment confirmation
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Booking, BookingStatusEnum, PaymentStatusEnum, User
from schemas import (
    BookingCreate, BookingResponse, CancelBookingRequest,
    PNRStatusResponse, MessageResponse,
)
from services.booking_service import create_booking, cancel_booking
from routers.auth import get_current_user, get_current_admin

from fastapi import Header
from typing import Optional
from cache.rate_limiter import rate_limit, booking_limiter

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def book_ticket(
    booking_data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_idempotency_key: Optional[str] = Header(None),          # Preserved from Level 2
    _rate_limit: None = Depends(rate_limit(booking_limiter)), # Added in Level 3
):
    """
    Book a train ticket.

    The heavy logic lives in services/booking_service.py — the router just
    handles HTTP concerns (auth, status codes, response serialisation).

    Request body example:
    {
      "train_id": "...",
      "seat_class_id": "...",
      "source_station_code": "NDLS",
      "destination_station_code": "CSTM",
      "journey_date": "2025-12-01",
      "passengers": [
        {"full_name": "Ravi Kumar", "age": 28, "gender": "M", "berth_preference": "LB"}
      ]
    }
    """
    booking = create_booking(db=db, booking_data=booking_data, user_id=current_user.id, idempotency_key=x_idempotency_key)
    return create_booking(
        db=db,
        booking_data=booking_data,
        user_id=current_user.id,
        idempotency_key=x_idempotency_key,
    )


@router.get("", response_model=List[BookingResponse])
def my_bookings(
    status_filter: BookingStatusEnum = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all bookings for the logged-in user, optionally filtered by status."""
    query = db.query(Booking).filter(Booking.user_id == current_user.id)
    if status_filter:
        query = query.filter(Booking.status == status_filter)
    return query.order_by(Booking.created_at.desc()).all()


@router.get("/pnr/{pnr}", response_model=PNRStatusResponse)
def pnr_status(pnr: str, db: Session = Depends(get_db)):
    """
    Check PNR status — publicly accessible, no login needed.
    This mirrors how IRCTC allows anyone to check a PNR.
    """
    booking = db.query(Booking).filter(Booking.pnr == pnr).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PNR {pnr} not found",
        )
    return PNRStatusResponse(
        pnr=booking.pnr,
        status=booking.status,
        payment_status=booking.payment_status,
        journey_date=booking.journey_date,
        total_amount=booking.total_amount,
        train_number=booking.train.train_number,
        train_name=booking.train.train_name,
        departure_time=booking.train.departure_time,
        arrival_time=booking.train.arrival_time,
        source_station=booking.source_station.name,
        destination_station=booking.destination_station.name,
        passengers=booking.passengers,
    )


@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full details of a specific booking (must belong to current user)."""
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == current_user.id,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.put("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_ticket(
    booking_id: str,
    cancel_data: CancelBookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancel a booking.

    The service layer handles:
      - Restoring seat availability
      - Updating all passenger statuses
      - Setting payment status to REFUNDED

    Level 1: Refund is instant and full (simplified).
    Level 2: Will add partial refund based on cancellation time.
    """
    booking = cancel_booking(
        db=db,
        booking_id=booking_id,
        user_id=current_user.id,
        reason=cancel_data.reason or "Cancelled by user",
    )
    return booking


@router.put("/{booking_id}/payment", response_model=BookingResponse)
def confirm_payment(
    booking_id: str,
    transaction_id: str = Query(..., description="Payment gateway transaction ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Simulate payment confirmation.

    In real IRCTC, after seat allocation the booking is in PENDING payment state.
    The payment gateway (Razorpay / PayU) sends a webhook confirming payment.

    Level 1: We accept any transaction_id as "confirmed".
    Level 2: Will add signature verification and idempotency.
    Level 4: Will use Kafka + Saga pattern for payment events.
    """
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == current_user.id,
    ).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == BookingStatusEnum.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot pay for a cancelled booking")

    if booking.payment_status == PaymentStatusEnum.SUCCESS:
        raise HTTPException(status_code=400, detail="Payment already confirmed")

    booking.payment_status = PaymentStatusEnum.SUCCESS
    booking.transaction_id = transaction_id
    db.commit()
    db.refresh(booking)
    return booking

@router.get('/admin/all', response_model=List[BookingResponse])
def all_bookings(
    status_filter: BookingStatusEnum = Query(None, alias='status'),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Admin only — returns every booking in the system."""
    q = db.query(Booking)
    if status_filter:
        q = q.filter(Booking.status == status_filter)
    return q.order_by(Booking.created_at.desc()).limit(500).all()