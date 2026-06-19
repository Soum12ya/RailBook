"""
routers/trains.py — Train and station management

Public:
  GET  /stations            → list all stations
  GET  /stations/{code}     → get one station by code
  POST /trains/search       → search trains between two stations on a date

Admin-only:
  POST /stations            → add a new station
  POST /trains              → add a new train with stops and seat classes
  GET  /trains/{id}         → get full train details
  PUT  /trains/{id}/status  → activate/deactivate a train
"""

# routers/trains.py — Train and station management
from datetime import date
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Station, Train, TrainStop, SeatClass, SeatClassEnum, User
from schemas import (
    StationCreate, StationResponse,
    TrainCreate, TrainResponse, TrainAvailability, SeatClassResponse,
    TrainSearchRequest, MessageResponse,
)
from routers.auth import get_current_user, get_current_admin

# ─── LEVEL 3 UPDATES: CACHE, SEARCH & RATE LIMIT IMPORTS ────────────────────
from search.searcher import search_trains as es_search_trains, search_stations as es_search_stations
from search.indexer import index_train, index_station, update_train_status
from cache.redis_client import cache_get, cache_set, cache_delete_pattern, trains_search_key
from cache.rate_limiter import rate_limit, search_limiter
from config import settings

router = APIRouter(tags=["Trains & Stations"])


# ─── STATIONS ────────────────────────────────────────────────────────────────

@router.get("/stations", response_model=List[StationResponse])
def list_stations(
    search: Optional[str] = Query(None, description="Filter by name, city or code"),
    db: Session = Depends(get_db),
):
    """List all stations, optionally filtered by search term."""
    query = db.query(Station)
    if search:
        term = f"%{search.upper()}%"
        query = query.filter(
            Station.code.ilike(term) |
            Station.name.ilike(f"%{search}%") |
            Station.city.ilike(f"%{search}%")
        )
    return query.order_by(Station.name).all()


# ─── LEVEL 3 UPDATE: STATION AUTOCOMPLETE VIA ELASTICSEARCH ──────────────────
@router.get('/stations/search')
def fulltext_search_stations(
    q: str = Query(..., min_length=1, description='Station code prefix or city name'),
    limit: int = Query(10, le=50),
    _: None = Depends(rate_limit(search_limiter)),
):
    """
    Station autocomplete dropdown feed. Matches prefix and handles typos.
    Example: GET /stations/search?q=NDL ➔ returns NDLS
    """
    return es_search_stations(q, limit)


@router.get("/stations/{code}", response_model=StationResponse)
def get_station(code: str, db: Session = Depends(get_db)):
    station = db.query(Station).filter(Station.code == code.upper()).first()
    if not station:
        raise HTTPException(status_code=404, detail=f"Station '{code}' not found")
    return station


@router.post("/stations", response_model=StationResponse, status_code=201)
def create_station(
    data: StationCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin: Add a new railway station."""
    if db.query(Station).filter(Station.code == data.code.upper()).first():
        raise HTTPException(status_code=409, detail=f"Station code '{data.code}' already exists")

    station = Station(
        code=data.code.upper(),
        name=data.name,
        city=data.city,
        state=data.state,
        zone=data.zone,
    )
    db.add(station)
    db.commit()
    db.refresh(station)

    # ─── LEVEL 3 UPDATE: MIRROR STATION TO ELASTICSEARCH ────────────────────
    try:
        index_station(station)
    except Exception as e:
        # Logging here would be ideal; fail-soft so DB transaction remains intact
        print(f"ES Indexing Error: {e}")

    return station


# ─── TRAINS ──────────────────────────────────────────────────────────────────

@router.post("/trains", response_model=TrainResponse, status_code=201)
def create_train(
    data: TrainCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Admin: Add a new train with its intermediate stops and seat classes.
    """
    if db.query(Train).filter(Train.train_number == data.train_number).first():
        raise HTTPException(status_code=409, detail=f"Train {data.train_number} already exists")

    src = db.query(Station).filter(Station.code == data.source_station_code.upper()).first()
    if not src:
        raise HTTPException(status_code=404, detail=f"Source station '{data.source_station_code}' not found")

    dest = db.query(Station).filter(Station.code == data.destination_station_code.upper()).first()
    if not dest:
        raise HTTPException(status_code=404, detail=f"Destination station '{data.destination_station_code}' not found")

    train = Train(
        train_number=data.train_number,
        train_name=data.train_name,
        source_station_id=src.id,
        destination_station_id=dest.id,
        departure_time=data.departure_time,
        arrival_time=data.arrival_time,
        duration_mins=data.duration_mins,
        total_distance_km=data.total_distance_km,
        days_of_week=data.days_of_week,
    )
    db.add(train)
    db.flush()

    for stop_data in data.stops:
        stop_station = db.query(Station).filter(Station.code == stop_data.station_code.upper()).first()
        if not stop_station:
            raise HTTPException(status_code=404, detail=f"Stop station '{stop_data.station_code}' not found")
        stop = TrainStop(
            train_id=train.id,
            station_id=stop_station.id,
            stop_order=stop_data.stop_order,
            arrival_time=stop_data.arrival_time,
            departure_time=stop_data.departure_time,
            distance_km=stop_data.distance_km,
        )
        db.add(stop)

    for sc_data in data.seat_classes:
        seat_class = SeatClass(
            train_id=train.id,
            class_type=sc_data.class_type,
            total_seats=sc_data.total_seats,
            available_seats=sc_data.total_seats,
            rac_seats=sc_data.rac_seats,
            rac_available=sc_data.rac_seats,
            waitlist_quota=sc_data.waitlist_quota,
            current_waitlist=0,
            base_fare_per_km=sc_data.base_fare_per_km,
        )
        db.add(seat_class)

    db.commit()
    db.refresh(train)

    # ─── LEVEL 3 UPDATE: MIRROR TRAIN DATA TO ELASTICSEARCH ────────────────
    try:
        index_train(train)
    except Exception as e:
        print(f"ES Indexing Error: {e}")

    return train


# ─── LEVEL 3 UPDATE: FULL-TEXT TRAIN SEARCH VIA ELASTICSEARCH ───────────────
@router.get('/trains/search')
def fulltext_search_trains(
    q: str = Query(..., min_length=2, description='Train name, number, or city'),
    limit: int = Query(10, le=50),
    _: None = Depends(rate_limit(search_limiter)),
):
    """
    Fuzzy full-text train search. Tolerates structural spelling typos.
    Example: GET /trains_and_stations/trains/search?q=rajdhni
    """
    return es_search_trains(q, limit)


@router.get("/trains/{train_id}", response_model=TrainResponse)
def get_train(train_id: str, db: Session = Depends(get_db)):
    train = db.query(Train).filter(Train.id == train_id).first()
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")
    return train


# ─── LEVEL 3 UPDATE: CACHED STRUCTURED TRAIN AVAILABILITY ROUTE ─────────────
@router.post("/trains/search", response_model=List[TrainAvailability])
def search_trains(search: TrainSearchRequest, db: Session = Depends(get_db)):
    """Intermediate-stop aware search with Read-Through Redis cache."""

    # 1. Cache check (unchanged from your Level 3 version)
    cache_key = trains_search_key(
        search.source_station_code,
        search.destination_station_code,
        str(search.journey_date),
        search.class_type.value if search.class_type else '',
    )
    cached = cache_get(cache_key)
    if cached is not None:
        return cached  # ◄ Cache hit — skip DB entirely

    # 2. Resolve stations
    src = db.query(Station).filter(
        Station.code == search.source_station_code.upper()
    ).first()
    if not src:
        raise HTTPException(status_code=404, detail=f"Station '{search.source_station_code}' not found")

    dest = db.query(Station).filter(
        Station.code == search.destination_station_code.upper()
    ).first()
    if not dest:
        raise HTTPException(status_code=404, detail=f"Station '{search.destination_station_code}' not found")

    # 3. NEW: stop-based search — covers terminal AND intermediate stations
    #    Old code: Train.source_station_id == src.id (terminal only)
    #    New code: both stations appear as stops, source before destination
    src_stops  = db.query(TrainStop).filter(TrainStop.station_id == src.id).all()
    dest_stops = db.query(TrainStop).filter(TrainStop.station_id == dest.id).all()

    src_map  = {s.train_id: s.stop_order for s in src_stops}   # train_id → src order
    dest_map = {s.train_id: s.stop_order for s in dest_stops}  # train_id → dest order

    valid_train_ids = [
        tid for tid in src_map
        if tid in dest_map and src_map[tid] < dest_map[tid]
    ]

    if not valid_train_ids:
        cache_set(cache_key, [], ttl=settings.CACHE_TTL_SECONDS)
        return []

    trains = db.query(Train).filter(
        Train.id.in_(valid_train_ids),
        Train.is_active == True,
    ).all()

    # 4. Build results (same as before)
    journey_weekday = search.journey_date.weekday()
    results = []
    for train in trains:
        classes = train.seat_classes
        if search.class_type:
            classes = [c for c in classes if c.class_type == search.class_type]
        results.append(TrainAvailability(
            train_id=train.id,
            train_number=train.train_number,
            train_name=train.train_name,
            departure_time=train.departure_time,
            arrival_time=train.arrival_time,
            duration_mins=train.duration_mins,
            source_station=src.name,
            destination_station=dest.name,
            runs_on_date=journey_weekday in train.days_of_week,
            available_classes=[SeatClassResponse.model_validate(c) for c in classes],
        ))

    # 5. Cache the results (unchanged from your Level 3 version)
    serialized_results = [r.model_dump(mode='json') for r in results]
    cache_set(cache_key, serialized_results, ttl=settings.CACHE_TTL_SECONDS)

    return results


@router.put("/trains/{train_id}/status", response_model=MessageResponse)
def toggle_train_status(
    train_id: str,
    is_active: bool = Query(..., description="true to activate, false to deactivate"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin: Activate or deactivate a train."""
    train = db.query(Train).filter(Train.id == train_id).first()
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")
    
    train.is_active = is_active
    db.commit()

    # ─── LEVEL 3 UPDATES: ELASTICSEARCH UPDATE & SEARCH CACHE BAN ───────────
    try:
        update_train_status(train_id, is_active)
    except Exception as e:
        print(f"ES Status Update Error: {e}")
        
    # Wipe any active search sets so users do not see deactivated inventory
    cache_delete_pattern('search:*')

    return {"message": f"Train {train.train_number} {'activated' if is_active else 'deactivated'}"}