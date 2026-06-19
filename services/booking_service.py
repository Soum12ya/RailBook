import math
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from models import Booking, Passenger, SeatClass, BookingStatusEnum, PaymentStatusEnum
from schemas import BookingCreate
from repositories.booking_repo import BookingRepository, PassengerRepository
from repositories.train_repo import SeatClassRepository, StationRepository, TrainRepository

from cache.seat_cache import invalidate_seat_cache, build_seat_snapshot, set_cached_seat_availability
from workers.notification_tasks import send_booking_confirmation, send_cancellation_confirmation
from workers.promotion_tasks import run_waitlist_promotion


GST_RATE = 0.05
REFUND_POLICY = [(48, 0.90), (12, 0.75), (4, 0.50), (0, 0.00)]


def calculate_fare(seat_class, distance_km, passenger_count):
    base = seat_class.base_fare_per_km * distance_km
    return round((base + base * GST_RATE) * passenger_count, 2)


def calculate_refund(total_amount, journey_date, departure_time):
    try:
        h, m = map(int, departure_time.split(':'))
        dep = datetime(
            journey_date.year, journey_date.month, journey_date.day,
            h, m, tzinfo=timezone.utc
        )
        hours = (dep - datetime.now(timezone.utc)).total_seconds() / 3600
        for threshold, pct in REFUND_POLICY:
            if hours >= threshold:
                return round(total_amount * pct, 2)
        return 0.0
    except Exception:
        return round(total_amount * 0.50, 2)


def _assign_seat(seat_class, passenger_index):
    prefix   = {'SL':'S','3A':'B','2A':'A','1A':'H','CC':'C','EC':'EC','GN':'GN'}
    capacity = {'SL':72,'3A':64,'2A':46,'1A':24,'CC':78,'EC':56,'GN':108}
    p   = prefix.get(seat_class.class_type.value, 'X')
    cap = capacity.get(seat_class.class_type.value, 72)
    booked  = seat_class.total_seats - seat_class.available_seats
    seat_n  = booked + passenger_index + 1
    coach_n = math.ceil(seat_n / cap)
    berth   = ((seat_n - 1) % cap) + 1
    return f'{p}{coach_n}', str(berth)


def create_booking(
    db: Session,
    booking_data: BookingCreate,
    user_id: str,
    idempotency_key: Optional[str] = None,
):
    booking_repo    = BookingRepository(db)
    seat_class_repo = SeatClassRepository(db)
    station_repo    = StationRepository(db)
    train_repo      = TrainRepository(db)

    # 1. Idempotency check
    if idempotency_key:
        existing = booking_repo.get_by_idempotency_key(idempotency_key)
        if existing:
            return existing

    # 2. Validate train
    train = train_repo.get_by_id(booking_data.train_id)
    if not train or not train.is_active:
        raise HTTPException(status_code=404, detail='Train not found')
    if booking_data.journey_date.weekday() not in train.days_of_week:
        raise HTTPException(status_code=400,
            detail=f'Train does not run on {booking_data.journey_date.strftime("%A")}')

    # 3. Validate stations
    src = station_repo.get_by_code(booking_data.source_station_code)
    if not src:
        raise HTTPException(status_code=404, detail='Source station not found')
    dest = station_repo.get_by_code(booking_data.destination_station_code)
    if not dest:
        raise HTTPException(status_code=404, detail='Destination station not found')

    # 4. SELECT FOR UPDATE — lock the row
    seat_class = seat_class_repo.get_seat_class_with_lock(
        booking_data.seat_class_id,
        booking_data.train_id,
    )
    if not seat_class:
        raise HTTPException(status_code=404, detail='Seat class not found')

    # 5. Allocation using LOCKED values
    n         = len(booking_data.passengers)
    confirmed = min(n, seat_class.available_seats)
    rac_count = min(n - confirmed, seat_class.rac_available)
    wl_count  = n - confirmed - rac_count

    if wl_count > 0:
        remaining_wl = seat_class.waitlist_quota - seat_class.current_waitlist
        if wl_count > remaining_wl:
            raise HTTPException(status_code=400, detail='No seats available')

    if confirmed == n:
        booking_status = BookingStatusEnum.CONFIRMED
    elif confirmed + rac_count == n:
        booking_status = BookingStatusEnum.RAC
    else:
        booking_status = BookingStatusEnum.WAITING

    # 6. Fare + decrement (safe — row is locked)
    total_amount = calculate_fare(seat_class, train.total_distance_km, n)
    seat_class.available_seats  -= confirmed
    seat_class.rac_available    -= rac_count
    seat_class.current_waitlist += wl_count

    # 7. Create booking + passengers
    booking = Booking(
        user_id=user_id,
        train_id=train.id,
        seat_class_id=seat_class.id,
        source_station_id=src.id,
        destination_station_id=dest.id,
        journey_date=booking_data.journey_date,
        status=booking_status,
        total_amount=total_amount,
        payment_status=PaymentStatusEnum.PENDING,
        idempotency_key=idempotency_key,
    )
    db.add(booking)
    db.flush()

    wl_start = seat_class.current_waitlist
    for i, p_data in enumerate(booking_data.passengers):
        if i < confirmed:
            p_status = BookingStatusEnum.CONFIRMED
            coach, seat = _assign_seat(seat_class, i)
            wl_num = None
        elif i < confirmed + rac_count:
            p_status = BookingStatusEnum.RAC
            coach, seat = 'RAC', str(i - confirmed + 1)
            wl_num = None
        else:
            p_status = BookingStatusEnum.WAITING
            coach = seat = None
            wl_num = wl_start - wl_count + (i - confirmed - rac_count) + 1

        db.add(Passenger(
            booking_id=booking.id,
            full_name=p_data.full_name,
            age=p_data.age,
            gender=p_data.gender,
            berth_preference=p_data.berth_preference,
            seat_number=seat,
            coach_number=coach,
            status=p_status,
            waitlist_number=wl_num,
        ))

    db.commit()  # releases FOR UPDATE lock
    db.refresh(booking)

    # ── Level 3: Cache Eviction & Synchronization ─────────────────────
    # Bust the cache first to prevent any stale data reads mid-flight
    invalidate_seat_cache(
        train_id=booking.train_id,
        seat_class_id=booking.seat_class_id, 
        journey_date=str(booking_data.journey_date),
    )
    
    # Proactively warm the cache immediately with fresh transactional numbers
    set_cached_seat_availability(
        train_id=booking.train_id,
        seat_class_id=booking.seat_class_id,
        journey_date=str(booking_data.journey_date),
        data=build_seat_snapshot(booking.seat_class),
    )

    # ── Level 3: Non-Blocking Asynchronous Notifications ──────────────
    # Delegate email delivery to background Celery workers
    send_booking_confirmation.delay(
        to_email=booking.user.email,
        user_name=booking.user.full_name,
        pnr=booking.pnr,
        train_name=booking.train.train_name,
        journey_date=str(booking_data.journey_date),
        status=booking.status.value,
        total_amount=booking.total_amount,
    )

    return booking


def cancel_booking(db: Session, booking_id: str, user_id: str, reason: str):
    booking_repo   = BookingRepository(db)
    # NOTE: passenger_repo is removed from here because promotions happen in Celery now

    booking = booking_repo.get_by_id(booking_id)
    if not booking or booking.user_id != user_id:
        raise HTTPException(status_code=404, detail='Booking not found')
    if booking.status == BookingStatusEnum.CANCELLED:
        raise HTTPException(status_code=400, detail='Already cancelled')

    sc    = booking.seat_class
    train = booking.train
    date  = booking.journey_date

    # 1. Calculate how many slots are being abandoned by this specific booking
    conf_c = sum(1 for p in booking.passengers if p.status == BookingStatusEnum.CONFIRMED)
    rac_c  = sum(1 for p in booking.passengers if p.status == BookingStatusEnum.RAC)
    wl_c   = sum(1 for p in booking.passengers if p.status == BookingStatusEnum.WAITING)

    # 2. Return the inventory directly back to the master train pools
    sc.available_seats  += conf_c
    sc.rac_available    += rac_c
    sc.current_waitlist  = max(0, sc.current_waitlist - wl_c)

    # ── CRITICAL FIX ────────────────────────────────────────────────────────
    # The 'for _ in range(conf_c):' and 'for _ in range(rac_c):' loops 
    # have been DELETED from here. Celery handles them out-of-band now.
    # ────────────────────────────────────────────────────────────────────────

    # 3. Handle processing financial math & parent booking tracking
    refund = calculate_refund(booking.total_amount, date, train.departure_time)
    booking.status              = BookingStatusEnum.CANCELLED
    booking.cancellation_reason = reason
    booking.cancelled_at        = datetime.now(timezone.utc)
    booking.refund_amount       = refund
    booking.payment_status      = (
        PaymentStatusEnum.REFUNDED if refund > 0 else booking.payment_status
    )
    
    # 4. Wipe allocations and cancel all passenger records on this specific ticket
    for p in booking.passengers:
        p.status = BookingStatusEnum.CANCELLED
        p.coach_number = None
        p.seat_number = None

    # 5. Secure changes to PostgreSQL database
    db.commit()

    # ── Level 3: Cache Invalidation ───────────────────────────────────
    # Drop from Redis immediately so search feeds reflect accurate seat maps
    invalidate_seat_cache(
        train_id=booking.train_id,
        seat_class_id=booking.seat_class_id,
        journey_date=str(booking.journey_date),
    )

    # Variables mapping cleanly to your background task signatures
    freed_confirmed = conf_c
    freed_rac = rac_c

    # ── Level 3: Async Waitlist Promotion Cascade ─────────────────────
    # Fire-and-forget message handling via RabbitMQ
    if freed_confirmed > 0 or freed_rac > 0:
        run_waitlist_promotion.delay(
            train_id=booking.train_id,
            seat_class_id=booking.seat_class_id,
            journey_date=str(booking.journey_date),
            freed_confirmed=freed_confirmed,
            freed_rac=freed_rac,
        )

    # ── Level 3: Async Cancellation Alert Receipt ─────────────────────
    send_cancellation_confirmation.delay(
        to_email=booking.user.email,
        user_name=booking.user.full_name,
        pnr=booking.pnr,
        refund_amount=booking.refund_amount,
    )
    
    db.refresh(booking)
    return booking