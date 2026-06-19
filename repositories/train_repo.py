"""
repositories/train_repo.py — Train, Station, SeatClass queries (Level 2)

All raw database queries for the train domain live here.
Services import and use these methods — they never write
db.query(...) themselves.

Key method: get_seat_class_with_lock()
  Uses SELECT FOR UPDATE — the Level 2 core fix for double booking.
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from models import Train, Station, SeatClass
from repositories.base import BaseRepository


class StationRepository(BaseRepository[Station]):

    def __init__(self, db: Session):
        super().__init__(Station, db)

    def get_by_code(self, code: str) -> Optional[Station]:
        """Fetch a station by its railway code (e.g. 'NDLS')."""
        return (
            self.db.query(Station)
            .filter(Station.code == code.upper())
            .first()
        )

    def search(self, term: str) -> List[Station]:
        """Search stations by code, name, or city."""
        t = f"%{term}%"
        return (
            self.db.query(Station)
            .filter(
                Station.code.ilike(t) |
                Station.name.ilike(t) |
                Station.city.ilike(t)
            )
            .order_by(Station.name)
            .all()
        )


class TrainRepository(BaseRepository[Train]):

    def __init__(self, db: Session):
        super().__init__(Train, db)

    def get_by_number(self, train_number: str) -> Optional[Train]:
        return (
            self.db.query(Train)
            .filter(Train.train_number == train_number)
            .first()
        )

    def search_by_route(
        self,
        source_station_id: str,
        destination_station_id: str,
    ) -> List[Train]:
        """Find active trains between two stations."""
        return (
            self.db.query(Train)
            .filter(
                Train.source_station_id == source_station_id,
                Train.destination_station_id == destination_station_id,
                Train.is_active == True,
            )
            .all()
        )


class SeatClassRepository(BaseRepository[SeatClass]):

    def __init__(self, db: Session):
        super().__init__(SeatClass, db)

    def get_by_train_and_type(
        self, train_id: str, class_type
    ) -> Optional[SeatClass]:
        return (
            self.db.query(SeatClass)
            .filter(
                SeatClass.train_id == train_id,
                SeatClass.class_type == class_type,
            )
            .first()
        )

    def get_seat_class_with_lock(self, seat_class_id: str, train_id: str) -> Optional[SeatClass]:
        """
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        THE LEVEL 2 CORE FIX — SELECT FOR UPDATE
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        .with_for_update() adds FOR UPDATE to the SQL:

            SELECT * FROM seat_classes
            WHERE id = '...' AND train_id = '...'
            FOR UPDATE;

        PostgreSQL behaviour:
          - Thread A calls this → acquires an exclusive row lock
          - Thread B calls this for the SAME row → BLOCKS here
          - Thread A commits → Thread B unblocks and reads
            the UPDATED value (0 seats, not 1)
          - Thread B sees 0 seats → returns error, no double booking

        Cost: serialised access to this row. For Tatkal booking
        surges (100k concurrent users), Level 4 uses Redis
        distributed locks instead — database locks don't scale
        across multiple DB servers.

        At Level 2 with a single PostgreSQL instance, this is
        the correct, simple, and proven solution.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        """
        return (
            self.db.query(SeatClass)
            .filter(
                SeatClass.id == seat_class_id,
                SeatClass.train_id == train_id,
            )
            .with_for_update()   # ← THE FIX
            .first()
        )