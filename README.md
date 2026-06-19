# Train Ticket Booking Platform — Level 1
 
> A production-oriented IRCTC-like booking system. Built to learn, designed to evolve.
 
---
 
## Architecture (Level 1)
 
```
┌─────────────────────────────────────────────────┐
│                  Client (Browser / Postman)     │
└─────────────────┬───────────────────────────────┘
                  │ HTTP
┌─────────────────▼───────────────────────────────┐
│           FastAPI Application (main.py)         │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  /auth   │  │ /trains  │  │  /bookings    │  │
│  │  router  │  │  router  │  │   router      │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │         │
│  ┌────▼──────────────▼────────────────▼───────┐ │
│  │          Service Layer                     │ │
│  │  auth_service.py   booking_service.py      │ │
│  └────────────────────────┬───────────────────┘ │
│                            │                    │
│  ┌─────────────────────────▼───────────────────┐│
│  │         SQLAlchemy ORM (models.py)          ││
│  └─────────────────────────┬───────────────────┘ │
└────────────────────────────┼─────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │    PostgreSQL Database      │
              │   (single DB, Level 1)      │
              └─────────────────────────────┘
```
 
**Data flow**: Request → Router (validates HTTP) → Service (business logic) → ORM → DB
 
---
 
## Quick Start
 
### Option A — Docker (recommended)
 
```bash
# Clone and start
git clone <repo>
cd train_booking
docker-compose up --build
 
# In a second terminal, seed sample data
docker exec train_booking_api python seed_data.py
```
 
Visit **http://localhost:8000/docs** — the interactive Swagger UI.
 
### Option B — Local Python
 
```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
 
# 2. Install dependencies
pip install -r requirements.txt
 
# 3. Set up PostgreSQL (must be running locally)
#    createdb train_booking
 
# 4. Copy env file and configure
cp .env.example .env
# Edit DATABASE_URL to point at your local Postgres
 
# 5. Start the server
uvicorn main:app --reload --port 8000
 
# 6. Seed sample data
python seed_data.py
```
 
---
 
## Database Schema
 
```
users
  id (PK, UUID)
  email (unique, indexed)
  phone (unique, indexed)
  full_name
  hashed_password   ← bcrypt, never plain text
  is_admin
  created_at
 
stations
  id (PK, UUID)
  code (unique, indexed)  ← e.g. "NDLS", "CSTM"
  name, city, state, zone
 
trains
  id (PK, UUID)
  train_number (unique, indexed)
  train_name
  source_station_id → stations.id
  destination_station_id → stations.id
  departure_time, arrival_time  ("HH:MM")
  duration_mins, total_distance_km
  days_of_week  (JSON array, 0=Mon … 6=Sun)
  is_active
 
train_stops
  id (PK, UUID)
  train_id → trains.id
  station_id → stations.id
  stop_order, arrival_time, departure_time, distance_km
 
seat_classes
  id (PK, UUID)
  train_id → trains.id
  class_type  (SL / 3A / 2A / 1A / CC / EC / GN)
  total_seats, available_seats   ← LIVE COUNTER
  rac_seats, rac_available
  waitlist_quota, current_waitlist
  base_fare_per_km
 
bookings
  id (PK, UUID)
  pnr (unique, indexed)  ← 10-digit, like IRCTC
  user_id → users.id
  train_id → trains.id
  seat_class_id → seat_classes.id
  source_station_id, destination_station_id
  journey_date
  status  (CONFIRMED / RAC / WAITING / CANCELLED)
  total_amount, payment_status, transaction_id
  created_at, cancelled_at
 
passengers
  id (PK, UUID)
  booking_id → bookings.id
  full_name, age, gender, berth_preference
  seat_number, coach_number
  status, waitlist_number
```
 
---
 
## API Endpoints
 
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | — | Create account |
| POST | /auth/login | — | Get JWT token |
| GET | /auth/me | ✓ | My profile |
| GET | /stations | — | List stations |
| GET | /stations/{code} | — | Get one station |
| POST | /stations | Admin | Add station |
| POST | /trains | Admin | Add train |
| GET | /trains/{id} | — | Train details |
| POST | /trains/search | — | Search trains |
| PUT | /trains/{id}/status | Admin | Activate/deactivate |
| POST | /bookings | ✓ | Book ticket |
| GET | /bookings | ✓ | My bookings |
| GET | /bookings/pnr/{pnr} | — | PNR status |
| GET | /bookings/{id} | ✓ | Booking detail |
| PUT | /bookings/{id}/cancel | ✓ | Cancel booking |
| PUT | /bookings/{id}/payment | ✓ | Confirm payment |
 
---
 
## Testing Flow (step-by-step)
 
```bash
BASE=http://localhost:8000
 
# 1. Register
curl -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Ravi Kumar","email":"ravi@test.com","phone":"9123456789","password":"ravi1234"}'
 
# 2. Login (save the token)
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -d "username=ravi@test.com&password=ravi1234" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
 
# 3. Search trains
curl -X POST $BASE/trains/search \
  -H "Content-Type: application/json" \
  -d '{"source_station_code":"NDLS","destination_station_code":"CSTM","journey_date":"2025-12-10"}'
 
# 4. Book a ticket (replace IDs from step 3)
curl -X POST $BASE/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "train_id": "<from_search>",
    "seat_class_id": "<from_search>",
    "source_station_code": "NDLS",
    "destination_station_code": "CSTM",
    "journey_date": "2025-12-10",
    "passengers": [
      {"full_name": "Ravi Kumar", "age": 28, "gender": "M", "berth_preference": "LB"}
    ]
  }'
 
# 5. Check PNR status (no auth needed)
curl $BASE/bookings/pnr/<YOUR_PNR>
 
# 6. Cancel booking
curl -X PUT $BASE/bookings/<BOOKING_ID>/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Change of plans"}'
```
 
---
 
## Key Engineering Concepts at Level 1
 
### Why SQLAlchemy ORM?
- Write Python classes, get SQL tables automatically
- `session.add()` + `session.commit()` = INSERT + COMMIT
- `session.rollback()` on errors keeps the DB consistent
- Easy to switch DB (SQLite → PostgreSQL) by changing one URL
### Why UUID primary keys?
- No auto-increment collisions when you later shard the DB
- PNR is human-readable (10 digits); internal ID is UUID
### Why JWT instead of sessions?
- Sessions require server-side storage (a `sessions` table or Redis)
- JWTs are self-contained — the token itself carries user info
- Server validates the signature, no DB lookup needed
- Scales horizontally without a shared session store
### The Concurrency Bug (learn this!)
At Level 1, the booking flow has a race condition:
```sql
-- Thread A                    -- Thread B
SELECT available_seats = 1     SELECT available_seats = 1
(1 seat available!)            (1 seat available!)
UPDATE SET available_seats = 0  UPDATE SET available_seats = 0
-- Both think they got the seat!
```
 
**Level 2 fix**: `SELECT ... FOR UPDATE` locks the row so Thread B
must wait until Thread A commits or rolls back.
 
---
 
## What's Next (Level 2)
 
- [ ] Fix the concurrency bug with `SELECT FOR UPDATE`
- [ ] Implement proper waitlist promotion when a booking cancels
- [ ] Add partial refund calculation based on cancellation time
- [ ] Layered architecture: proper Repository pattern
- [ ] Input validation layer (rate limiting per user)
- [ ] Admin analytics endpoints
- [ ] Alembic migrations (instead of create_all)