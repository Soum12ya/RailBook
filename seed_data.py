"""
seed_data.py — Populate the database with realistic sample data

Run AFTER starting the API (tables must exist):
    python seed_data.py

Creates:
  - An admin user (admin@trainbooking.com / admin1234)
  - A regular test user (user@test.com / user1234)
  - 8 major Indian railway stations
  - 3 trains with seat classes and stops
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine
import models
from models import (
    User, Station, Train, TrainStop, SeatClass,
    SeatClassEnum, BookingStatusEnum,
)
from services.auth_service import hash_password

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()


# ─── Users ───────────────────────────────────────────────────────────────────

def seed_users():
    if db.query(User).filter(User.email == "admin@trainbooking.com").first():
        print("Users already seeded, skipping.")
        return

    admin = User(
        full_name="Admin User",
        email="admin@trainbooking.com",
        phone="9000000001",
        hashed_password=hash_password("admin1234"),
        is_admin=True,
    )
    test_user = User(
        full_name="Test User",
        email="user@test.com",
        phone="9000000002",
        hashed_password=hash_password("user1234"),
    )
    db.add_all([admin, test_user])
    db.commit()
    print("✓ Users created")
    print("  Admin: admin@trainbooking.com / admin1234")
    print("  User:  user@test.com / user1234")


# ─── Stations ────────────────────────────────────────────────────────────────

STATIONS = [
    {"code": "NDLS", "name": "New Delhi",        "city": "New Delhi",    "state": "Delhi",             "zone": "NR"},
    {"code": "CSTM", "name": "Chhatrapati Shivaji Maharaj Terminus", "city": "Mumbai", "state": "Maharashtra", "zone": "CR"},
    {"code": "MAS",  "name": "Chennai Central",  "city": "Chennai",      "state": "Tamil Nadu",        "zone": "SR"},
    {"code": "HWH",  "name": "Howrah Junction",  "city": "Kolkata",      "state": "West Bengal",       "zone": "ER"},
    {"code": "BCT",  "name": "Mumbai Central",   "city": "Mumbai",       "state": "Maharashtra",       "zone": "WR"},
    {"code": "SBC",  "name": "Bengaluru City",   "city": "Bengaluru",    "state": "Karnataka",         "zone": "SWR"},
    {"code": "BPL",  "name": "Bhopal Junction",  "city": "Bhopal",       "state": "Madhya Pradesh",    "zone": "WCR"},
    {"code": "ADI",  "name": "Ahmedabad Junction","city": "Ahmedabad",   "state": "Gujarat",           "zone": "WR"},
    {"code": "PNBE", "name": "Patna Junction",   "city": "Patna",        "state": "Bihar",             "zone": "ECR"},
    {"code": "AGC",  "name": "Agra Cantt",        "city": "Agra",         "state": "Uttar Pradesh",     "zone": "NCR"},
]

def seed_stations():
    existing = {s.code for s in db.query(Station).all()}
    new_stations = []
    for s in STATIONS:
        if s["code"] not in existing:
            new_stations.append(Station(**s))
    if new_stations:
        db.add_all(new_stations)
        db.commit()
        print(f"✓ {len(new_stations)} stations created")
    else:
        print("Stations already seeded, skipping.")


def get_station(code: str) -> Station:
    s = db.query(Station).filter(Station.code == code).first()
    if not s:
        raise ValueError(f"Station {code} not found — run seed_stations first")
    return s


# ─── Trains ──────────────────────────────────────────────────────────────────

def seed_trains():
    if db.query(Train).filter(Train.train_number == "12301").first():
        print("Trains already seeded, skipping.")
        return

    # ── Train 1: Rajdhani Express (Delhi → Mumbai) ──
    ndls = get_station("NDLS")
    cstm = get_station("CSTM")
    bpl = get_station("BPL")

    raj = Train(
        train_number="12951",
        train_name="Mumbai Rajdhani Express",
        source_station_id=ndls.id,
        destination_station_id=cstm.id,
        departure_time="16:55",
        arrival_time="08:15",
        duration_mins=915,
        total_distance_km=1384,
        days_of_week=[0, 1, 2, 3, 4, 5, 6],  # daily
    )
    db.add(raj)
    db.flush()

    db.add_all([
        TrainStop(train_id=raj.id, station_id=ndls.id, stop_order=1, arrival_time=None,    departure_time="16:55", distance_km=0),
        TrainStop(train_id=raj.id, station_id=bpl.id,  stop_order=2, arrival_time="23:59", departure_time="00:05", distance_km=702),
        TrainStop(train_id=raj.id, station_id=cstm.id, stop_order=3, arrival_time="08:15", departure_time=None,    distance_km=1384),
    ])

    db.add_all([
        SeatClass(train_id=raj.id, class_type=SeatClassEnum.AC1, total_seats=24,  available_seats=24,  rac_seats=4,  rac_available=4,  waitlist_quota=20, current_waitlist=0, base_fare_per_km=4.60),
        SeatClass(train_id=raj.id, class_type=SeatClassEnum.AC2, total_seats=46,  available_seats=46,  rac_seats=8,  rac_available=8,  waitlist_quota=30, current_waitlist=0, base_fare_per_km=2.95),
        SeatClass(train_id=raj.id, class_type=SeatClassEnum.AC3, total_seats=64,  available_seats=64,  rac_seats=10, rac_available=10, waitlist_quota=50, current_waitlist=0, base_fare_per_km=2.05),
    ])

    # ── Train 2: Duronto Express (Delhi → Kolkata) ──
    hwh = get_station("HWH")
    pnbe = get_station("PNBE")

    dur = Train(
        train_number="12301",
        train_name="Howrah Rajdhani Express",
        source_station_id=ndls.id,
        destination_station_id=hwh.id,
        departure_time="17:00",
        arrival_time="09:55",
        duration_mins=1015,
        total_distance_km=1451,
        days_of_week=[0, 2, 4, 6],   # Mon, Wed, Fri, Sun
    )
    db.add(dur)
    db.flush()

    db.add_all([
        TrainStop(train_id=dur.id, station_id=ndls.id, stop_order=1, arrival_time=None,    departure_time="17:00", distance_km=0),
        TrainStop(train_id=dur.id, station_id=pnbe.id, stop_order=2, arrival_time="02:00", departure_time="02:10", distance_km=1001),
        TrainStop(train_id=dur.id, station_id=hwh.id,  stop_order=3, arrival_time="09:55", departure_time=None,    distance_km=1451),
    ])

    db.add_all([
        SeatClass(train_id=dur.id, class_type=SeatClassEnum.SL,  total_seats=500, available_seats=500, rac_seats=50, rac_available=50, waitlist_quota=200, current_waitlist=0, base_fare_per_km=0.45),
        SeatClass(train_id=dur.id, class_type=SeatClassEnum.AC3, total_seats=64,  available_seats=64,  rac_seats=10, rac_available=10, waitlist_quota=50,  current_waitlist=0, base_fare_per_km=2.05),
        SeatClass(train_id=dur.id, class_type=SeatClassEnum.AC2, total_seats=46,  available_seats=46,  rac_seats=8,  rac_available=8,  waitlist_quota=30,  current_waitlist=0, base_fare_per_km=2.95),
    ])

    # ── Train 3: Shatabdi Express (Delhi → Agra) ──
    agc = get_station("AGC")

    shatabdi = Train(
        train_number="12002",
        train_name="New Delhi Agra Shatabdi",
        source_station_id=ndls.id,
        destination_station_id=agc.id,
        departure_time="06:15",
        arrival_time="08:10",
        duration_mins=115,
        total_distance_km=200,
        days_of_week=[0, 1, 2, 3, 4, 5],   # Mon–Sat (no Sunday)
    )
    db.add(shatabdi)
    db.flush()

    db.add_all([
        TrainStop(train_id=shatabdi.id, station_id=ndls.id, stop_order=1, arrival_time=None,    departure_time="06:15", distance_km=0),
        TrainStop(train_id=shatabdi.id, station_id=agc.id,  stop_order=2, arrival_time="08:10", departure_time=None,    distance_km=200),
    ])

    db.add_all([
        SeatClass(train_id=shatabdi.id, class_type=SeatClassEnum.CC, total_seats=78,  available_seats=78,  rac_seats=4,  rac_available=4,  waitlist_quota=20, current_waitlist=0, base_fare_per_km=1.25),
        SeatClass(train_id=shatabdi.id, class_type=SeatClassEnum.EC, total_seats=56,  available_seats=56,  rac_seats=2,  rac_available=2,  waitlist_quota=10, current_waitlist=0, base_fare_per_km=2.10),
    ])

    db.commit()
    print("✓ 3 trains created:")
    print("  12951 Mumbai Rajdhani Express (NDLS → CSTM, daily)")
    print("  12301 Howrah Rajdhani Express (NDLS → HWH, Mon/Wed/Fri/Sun)")
    print("  12002 New Delhi Agra Shatabdi (NDLS → AGC, Mon–Sat)")


# ─── Run all seeds ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n🚂 Seeding database...\n")
    seed_users()
    seed_stations()
    seed_trains()
    print("\n✅ Done! Visit http://localhost:8000/docs to explore the API.\n")
    db.close()