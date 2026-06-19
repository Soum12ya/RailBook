"""
repositories/booking_repo.py — Booking and Passenger queries (Level 2)

Key new query: get_next_in_queue()
  Used by the waitlist promotion cascade after a cancellation.
  Finds the next RAC or WL passenger for a given train/class/date
  ordered by their position in the queue.
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import asc
from models import Booking, Passenger, BookingStatusEnum
from repositories.base import BaseRepository


class BookingRepository(BaseRepository[Booking]):

    def __init__(self, db: Session):
        super().__init__(Booking, db)

    def get_by_pnr(self, pnr: str) -> Optional[Booking]:
        return (
            self.db.query(Booking)
            .filter(Booking.pnr == pnr)
            .first()
        )

    def get_by_idempotency_key(self, key: str) -> Optional[Booking]:
        """
        IDEMPOTENCY CHECK — Level 2 feature.

        If a client sends the same booking request twice (e.g. network
        timeout, user double-clicked), this returns the existing booking
        instead of creating a duplicate.

        The client must:
          1. Generate a unique UUID for each NEW booking attempt
          2. Send it as the X-Idempotency-Key header
          3. If they retry, send the SAME key

        The server:
          1. Checks if a booking with this key already exists
          2. If yes → return the existing booking (no new DB writes)
          3. If no → create the booking, store the key
        """
        return (
            self.db.query(Booking)
            .filter(Booking.idempotency_key == key)
            .first()
        )

    def get_user_bookings(
        self,
        user_id: str,
        status: Optional[BookingStatusEnum] = None,
    ) -> List[Booking]:
        query = (
            self.db.query(Booking)
            .filter(Booking.user_id == user_id)
        )
        if status:
            query = query.filter(Booking.status == status)
        return query.order_by(Booking.created_at.desc()).all()


class PassengerRepository(BaseRepository[Passenger]):

    def __init__(self, db: Session):
        super().__init__(Passenger, db)

    def get_next_rac_passenger(
        self,
        train_id: str,
        seat_class_id: str,
        journey_date,
    ) -> Optional[Passenger]:
        """
        Find the first RAC passenger for a given train/class/date.
        Used when a CONFIRMED booking cancels — this passenger
        should be promoted to CONFIRMED status.

        Ordered by booking.created_at ASC so the earliest
        booking in RAC gets promoted first (FIFO queue).
        """
        return (
            self.db.query(Passenger)
            .join(Booking, Passenger.booking_id == Booking.id)
            .filter(
                Booking.train_id == train_id,
                Booking.seat_class_id == seat_class_id,
                Booking.journey_date == journey_date,
                Passenger.status == BookingStatusEnum.RAC,
            )
            .order_by(asc(Booking.created_at))
            .first()
        )

    def get_next_waitlist_passenger(
        self,
        train_id: str,
        seat_class_id: str,
        journey_date,
    ) -> Optional[Passenger]:
        """
        Find the WL passenger with the lowest waitlist_number.
        Used when a RAC booking cancels — this passenger gets
        promoted to RAC status.
        """
        return (
            self.db.query(Passenger)
            .join(Booking, Passenger.booking_id == Booking.id)
            .filter(
                Booking.train_id == train_id,
                Booking.seat_class_id == seat_class_id,
                Booking.journey_date == journey_date,
                Passenger.status == BookingStatusEnum.WAITING,
            )
            .order_by(asc(Passenger.waitlist_number))
            .first()
        )