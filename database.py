"""
database.py - Level 1 : Single PostgreSQL database, single engine.

At Level 1 we use one database for everything. Level 3 will add read replicas and Level 5 will add sharding.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings

# create_engine creates a connection pool (default: 5 connections).
# pool_pre_ping=True tests the connection before using it — prevents
# "server closed the connection unexpectedly" errors on long-running servers.

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=False, # Set True to log all SQL — useful while learning
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    """
    FastAPI dependency that yields a database session per request.
    The session is alaways closed in the finally block, even if an exception 
    occurs - this prevents connection leaks.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()    