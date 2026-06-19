"""
repositories/base.py — Generic base repository (Level 2)

WHY: At Level 1, every service function contained raw SQLAlchemy queries
     mixed with business logic. This made the code hard to test and reuse.

The Repository Pattern separates two concerns:
  - HOW to get data (repository)      ← only SQLAlchemy here
  - WHAT to do with data (service)    ← only business rules here

Every repository inherits from BaseRepository, which provides
standard CRUD operations for free. Specific repos add domain
queries on top (e.g. get_by_pnr, get_seat_class_with_lock).

SOLID principle applied here: Single Responsibility.
Each class has one job — database access for one model.
"""

from typing import Generic, TypeVar, Type, Optional, List
from sqlalchemy.orm import Session
from database import Base

# T is a placeholder for any SQLAlchemy model class
# e.g. BaseRepository[Booking] → T becomes Booking
ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Generic CRUD repository.
    Inherit from this and pass the model type:

        class BookingRepository(BaseRepository[Booking]):
            def __init__(self, db):
                super().__init__(Booking, db)
    """

    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db

    def get_by_id(self, id: str) -> Optional[ModelType]:
        """Fetch one record by primary key. Returns None if not found."""
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_all(self) -> List[ModelType]:
        """Fetch all records. Use with caution on large tables."""
        return self.db.query(self.model).all()

    def create(self, obj: ModelType) -> ModelType:
        """Persist a new record and return it with its generated ID."""
        self.db.add(obj)
        self.db.flush()   # write to session, get ID — don't commit yet
        return obj

    def delete(self, obj: ModelType) -> None:
        """Delete a record from the database."""
        self.db.delete(obj)

    def save(self) -> None:
        """Commit the current transaction."""
        self.db.commit()