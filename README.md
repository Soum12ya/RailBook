# 🚆 RailBook — Production-Grade Train Booking Platform

> A full-stack IRCTC-style train booking system built with **FastAPI + PostgreSQL + Redis + Elasticsearch + RabbitMQ + Celery + Next.js 14**, implementing every pattern that matters in real backend engineering: pessimistic locking, cache invalidation, async task queues, idempotency, full-text search, and waitlist promotion cascades.

<div align="center">

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8-005571?style=for-the-badge&logo=elasticsearch&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

</div>

---

## 📌 Why This Project Exists

Most student projects stop at CRUD. This one starts there and goes further — tackling the exact problems that cause production systems to fail under real load:

- **Two users booking the last seat simultaneously** → solved with `SELECT FOR UPDATE`
- **Stale seat counts after booking** → solved with targeted Redis cache invalidation
- **HTTP response blocked by email sending** → solved by dispatching Celery tasks to RabbitMQ
- **Search returning "No trains" for valid intermediate stops** → solved by querying `train_stops` instead of terminal stations
- **Duplicate bookings on network retry** → solved with idempotency keys
- **Instant logout without JWT expiry** → solved with Redis token blacklisting

Every architectural decision here maps directly to a real-world production pattern.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│              Next.js 14 · TypeScript · Tailwind CSS             │
│         (Search · Booking · PNR · Admin Panel · Auth)           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────────┐
│                          API LAYER                              │
│                    FastAPI (Uvicorn ASGI)                       │
│         Auth · Trains · Bookings · Admin · Health               │
└────┬──────────┬──────────┬──────────┬──────────┬───────────────┘
     │          │          │          │          │
┌────▼───┐ ┌───▼────┐ ┌───▼───┐ ┌───▼────┐ ┌──▼──────────┐
│Postgres│ │ Redis  │ │  ES   │ │Rabbit  │ │   Celery    │
│  18    │ │   7    │ │   8   │ │  MQ    │ │  Workers    │
│        │ │        │ │       │ │        │ │             │
│bookings│ │cache   │ │search │ │broker  │ │notifications│
│trains  │ │rate    │ │trains │ │queues  │ │promotions   │
│users   │ │limit   │ │stns   │ │tasks   │ │             │
│seats   │ │blacklst│ │       │ │        │ │             │
└────────┘ └────────┘ └───────┘ └────────┘ └─────────────┘
```

---

## 🔧 Tech Stack

### Backend
| Layer | Technology | Purpose |
|---|---|---|
| API Framework | FastAPI 0.104 | Async REST API, automatic OpenAPI docs |
| Database | PostgreSQL 18 | Primary data store, ACID transactions |
| ORM | SQLAlchemy 2.0 | Type-safe database access, connection pooling |
| Migrations | Alembic | Versioned schema changes, safe rollbacks |
| Cache | Redis 7 | Search result cache, seat availability, rate limiting |
| Search | Elasticsearch 8 | Full-text train/station search with fuzzy matching |
| Message Broker | RabbitMQ | Async task queue (notifications, promotions) |
| Task Queue | Celery 5 | Background workers with retry logic |
| Auth | JWT + bcrypt | Stateless auth, password hashing |
| Validation | Pydantic v2 | Request/response schema validation |

### Frontend
| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 14 App Router | SSR/CSR hybrid, file-based routing |
| Language | TypeScript 5 | Full type safety across API boundary |
| Styling | Tailwind CSS | Utility-first, responsive design |
| State | Zustand + persist | Auth state with localStorage persistence |
| Toast | react-hot-toast | User feedback on actions |

### Infrastructure
| Tool | Purpose |
|---|---|
| WSL2 + Ubuntu 22 | Development environment |
| Vercel | Frontend deployment |
| GitHub Actions ready | CI/CD pipeline |

---

## 🧠 Engineering Decisions That Matter

### 1. Pessimistic Locking — Preventing Double Booking

The most critical correctness problem in any booking system. When two users click "Book" for the last seat simultaneously, a naive implementation creates two confirmed bookings for one physical seat.

**The fix:** `SELECT ... FOR UPDATE` acquires an exclusive row lock in PostgreSQL. The second request waits at the database level — it cannot even read the seat count until the first transaction commits.

```python
# repositories/train_repo.py
def get_seat_class_with_lock(self, seat_class_id: str, train_id: str):
    return (
        db.query(SeatClass)
        .filter(SeatClass.id == seat_class_id, SeatClass.train_id == train_id)
        .with_for_update()   # ← PostgreSQL row-level lock
        .first()
    )
```

Without this, two threads reading `available_seats = 1` both proceed to confirm — a classic lost update. With this, Thread B blocks until Thread A commits, then reads `available_seats = 0` and correctly returns waitlist.

---

### 2. Read-Through Cache with Targeted Invalidation

Train search is the most frequent read. Without caching, every search executes a multi-join SQL query across trains, stops, and seat classes.

```
Search → Redis HIT → return in <1ms   (no DB hit)
Search → Redis MISS → PostgreSQL → store in Redis → return
Booking → PostgreSQL commit → invalidate search:* keys → next search hits DB fresh
```

Cache keys are structured for precise invalidation:
```
search:{src}:{dest}:{date}:{class}  → train search results
seats:{train_id}:{class_id}:{date}  → seat availability snapshot
bl:{token}                          → JWT blacklist for logout
ratelimit:{ip}                      → sliding window rate limit
```

When a booking is made, only the relevant search and seat keys are invalidated — not the entire cache.

---

### 3. Intermediate Stop Search

Real train routing is not point-to-point. A train from Howrah to Asansol stops at Bardhaman and Durgapur. Users should be able to search any valid sub-segment.

**Naive approach (broken):** Filter trains where `source_station_id = src AND destination_station_id = dest` — only matches terminal stations.

**Correct approach:** Query `train_stops` for both stations, then find trains where source stop order < destination stop order.

```python
src_map  = {s.train_id: s.stop_order for s in src_stops}
dest_map = {s.train_id: s.stop_order for s in dest_stops}

valid_ids = [
    tid for tid in src_map
    if tid in dest_map and src_map[tid] < dest_map[tid]
]
```

Now Howrah→Bardhaman, Bardhaman→Durgapur, and Durgapur→Asansol all return the correct train.

---

### 4. Async Notifications via Celery + RabbitMQ

Sending an email takes 300-800ms. Making the booking HTTP response wait for that is unacceptable. The solution: fire-and-forget to a message queue.

```
POST /bookings
  → PostgreSQL commit (50ms)
  → send_booking_confirmation.delay(...)  ← non-blocking, ~1ms
  → HTTP 201 response returned             ← user sees result immediately
       ↓
  RabbitMQ queue
       ↓
  Celery worker picks up task
       ↓
  SMTP email sent (300ms, in background)
```

Tasks are configured with automatic retry on failure:
```python
@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def send_booking_confirmation(self, ...):
    try:
        _send_email(...)
    except Exception as exc:
        raise self.retry(exc=exc)   # exponential back-off: 30s → 60s → 120s
```

---

### 5. Idempotency Keys — Safe Network Retries

When a client sends a booking request and gets a timeout, it doesn't know if the server processed it. Without idempotency, retrying creates a duplicate booking and double-charges the user.

Every booking request includes a client-generated UUID in the `X-Idempotency-Key` header. The server checks this key before processing:

```python
existing = booking_repo.get_by_idempotency_key(idempotency_key)
if existing:
    return existing   # return original booking — no duplicate
```

A UNIQUE constraint on `bookings.idempotency_key` provides a second layer — even if two requests with the same key arrive simultaneously, only one INSERT succeeds.

---

### 6. Waitlist Promotion Cascade

When a confirmed booking is cancelled, the seat queue must shift:
- First RAC passenger → CONFIRMED (gets real berth)
- First Waitlist passenger → RAC
- Remaining waitlist numbers shift down by 1

In Level 2 this ran synchronously inside the cancel HTTP request. In Level 3 it runs as a Celery background task — the HTTP response returns in ~50ms and promotion happens in the background, with email notifications fired for each promoted passenger.

---

### 7. Partial Refund Policy

Cancellation charges follow IRCTC's real refund policy:

| Time before departure | Refund |
|---|---|
| > 48 hours | 90% |
| 12 – 48 hours | 75% |
| 4 – 12 hours | 50% |
| < 4 hours | 0% |

```python
REFUND_POLICY = [(48, 0.90), (12, 0.75), (4, 0.50), (0, 0.00)]

def calculate_refund(total_amount, journey_date, departure_time):
    hours_before = (departure_dt - datetime.now(timezone.utc)).total_seconds() / 3600
    for threshold, pct in REFUND_POLICY:
        if hours_before >= threshold:
            return round(total_amount * pct, 2)
    return 0.0
```

---

### 8. Repository Pattern

Database queries are separated from business logic. Services never call `db.query()` directly — they use repository methods. This makes the system testable (swap real repos with fakes in tests) and maintainable (fix a query in one place).

```
routers/       → HTTP: parse request, call service, return response
services/      → Business rules: who gets a seat, how fare is calculated
repositories/  → Data access: all SQL lives here
models/        → ORM: table definitions
schemas/       → Pydantic: request/response validation
cache/         → Redis: caching, rate limiting, session store
workers/       → Celery: async task definitions
search/        → Elasticsearch: indexing and querying
```

---

## 📁 Project Structure

```
Ticket_System/                        ← FastAPI Backend
├── .env                              ← secrets (never committed)
├── config.py                         ← Pydantic settings from .env
├── database.py                       ← SQLAlchemy engine + session
├── models.py                         ← 7 ORM tables
├── schemas.py                        ← Pydantic request/response schemas
├── main.py                           ← FastAPI app, startup events
├── seed_data.py                      ← Seed DB with stations, trains, users
├── seed_elasticsearch.py             ← Bulk index existing data into ES
│
├── cache/                            ← Redis Layer
│   ├── redis_client.py               ← connection pool, get/set/delete
│   ├── rate_limiter.py               ← sliding-window limiter (Redis ZADD)
│   ├── seat_cache.py                 ← seat availability cache + invalidation
│   └── session_store.py             ← JWT blacklist for instant logout
│
├── workers/                          ← Celery + RabbitMQ
│   ├── celery_app.py                 ← broker config, named queues
│   ├── notification_tasks.py         ← booking/cancel/promotion emails
│   └── promotion_tasks.py           ← background waitlist cascade
│
├── search/                           ← Elasticsearch
│   ├── es_client.py                  ← client, index creation, mappings
│   ├── indexer.py                    ← index_train(), index_station()
│   └── searcher.py                  ← fuzzy search with field boosting
│
├── repositories/                     ← Data Access Layer
│   ├── base.py                       ← Generic CRUD base (Generic[T])
│   ├── train_repo.py                 ← Station, Train, SeatClass queries
│   └── booking_repo.py              ← Booking, Passenger, idempotency
│
├── services/                         ← Business Logic
│   ├── auth_service.py               ← bcrypt, JWT, blacklist check
│   └── booking_service.py           ← seat allocation, fare, cascade
│
├── routers/                          ← HTTP Route Handlers
│   ├── auth.py                       ← register, login, logout, /me
│   ├── trains.py                     ← search (cached), create (admin)
│   └── bookings.py                  ← book, cancel, PNR, payment
│
└── alembic/                          ← DB Migrations
    └── versions/                     ← versioned migration scripts

trainapp/                             ← Next.js 14 Frontend
├── src/
│   ├── app/
│   │   ├── page.tsx                  ← Home + PNR quick check
│   │   ├── search/page.tsx           ← Train search + booking modal
│   │   ├── pnr/page.tsx             ← Public PNR status lookup
│   │   ├── bookings/
│   │   │   ├── page.tsx             ← My bookings list with filters
│   │   │   └── [id]/page.tsx        ← Booking detail + cancel + pay
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── admin/
│   │       ├── page.tsx             ← Dashboard + system health
│   │       ├── trains/page.tsx      ← Train management + add train
│   │       ├── stations/page.tsx    ← Station management + add station
│   │       └── bookings/page.tsx    ← All bookings view
│   ├── components/
│   │   ├── layout/Navbar.tsx        ← Responsive nav, auth state
│   │   ├── booking/TrainCard.tsx    ← Search result card with classes
│   │   ├── booking/PassengerForm.tsx← Dynamic passenger entry (max 6)
│   │   └── ui/StationInput.tsx      ← Autocomplete with ES + debounce
│   ├── lib/
│   │   ├── api.ts                   ← All fetch calls to FastAPI
│   │   ├── adminApi.ts              ← Admin-only API calls
│   │   ├── store.ts                 ← Zustand auth store + persist
│   │   └── utils.ts                 ← formatTime, formatAmount, etc.
│   └── types/index.ts               ← TypeScript types mirroring backend schemas
```

---

## 🗄️ Database Schema

```
users ──────────────────────────────────────────────────────────┐
  id, email (unique), phone (unique), hashed_password, is_admin │
                                                                │
stations ────────────────────────────────┐                       │
  id, code (unique), name, city, state   │                       │
                                         │                       │
trains ──────────────────────────────────┤                       │
  id, train_number (unique)              │                       │
  source_station_id ──────────────────→ stations                 │
  destination_station_id ─────────────→ stations                 │
  days_of_week (JSON), is_active        │                        │
                                        │                        │
train_stops                             │                        │
  train_id ────────────────────────────→ trains                  │
  station_id ──────────────────────────→ stations                │
  stop_order, arrival_time, departure_time, distance_km          │
                                                                 │
seat_classes                                                     │
  train_id ────────────────────────────→ trains                  │
  class_type (SL/3A/2A/1A/CC/EC/GN)                              │
  available_seats, rac_available                                 │
  current_waitlist, waitlist_quota                               │
  base_fare_per_km                                               │
                                                                 │
bookings                                                         │
  user_id ─────────────────────────────────────────────────────→ users
  train_id ────────────────────────────→ trains                  │
  seat_class_id ───────────────────────→ seat_classes            │
  pnr (unique), status, payment_status                           │
  idempotency_key (unique), refund_amount                        │
                                                                 │
passengers                                                       │
  booking_id ──────────────────────────→ bookings                │
  full_name, age, gender, berth_preference                       │
  seat_number, coach_number, status, waitlist_number             │
```

---

## 🚀 Getting Started

### Prerequisites

```bash
# All running inside WSL2 Ubuntu 22/24
sudo service postgresql start    # port 5432
sudo service redis-server start  # port 6379
sudo service rabbitmq-server start  # port 5672
sudo service elasticsearch start    # port 9200
```

### Backend Setup

```bash
# 1. Clone and navigate
git clone https://github.com/YOUR_USERNAME/railbook
cd railbook/Ticket_System

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your DB credentials and secrets

# 5. Run database migrations
alembic upgrade head

# 6. Seed initial data
python3 seed_data.py

# 7. Start the API server
uvicorn main:app --reload --port 8000

# 8. Seed Elasticsearch
python3 seed_elasticsearch.py
```

### Start Celery Workers

```bash
# Terminal 2: Notification worker
celery -A workers.celery_app worker --queues=notifications --loglevel=info

# Terminal 3: Promotion worker
celery -A workers.celery_app worker --queues=promotions --loglevel=info

# Terminal 4: Monitor (optional)
celery -A workers.celery_app flower --port=5555
```

### Frontend Setup

```bash
cd railbook/trainapp
npm install

# Configure API URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev   # http://localhost:3000
```

### Test Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@trainbooking.com | admin1234 |
| User | user@test.com | user1234 |

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create account, returns JWT |
| POST | `/auth/login` | Public | Email + password → JWT |
| GET | `/auth/me` | Bearer | Current user profile |
| POST | `/auth/logout` | Bearer | Revoke JWT (Redis blacklist) |

### Trains & Stations
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/stations` | Public | List/search all stations |
| GET | `/stations/search?q=` | Public | ES autocomplete |
| POST | `/stations` | Admin | Create station |
| GET | `/trains/search?q=` | Public | ES full-text train search |
| POST | `/trains/search` | Public | Structured search (cached) |
| GET | `/trains/{id}` | Public | Train detail with seat classes |
| POST | `/trains` | Admin | Create train with stops and classes |
| PUT | `/trains/{id}/status` | Admin | Toggle active/inactive |

### Bookings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/bookings` | Bearer | Create booking (rate limited, idempotent) |
| GET | `/bookings` | Bearer | My bookings (with status filter) |
| GET | `/bookings/{id}` | Bearer | Single booking detail |
| GET | `/bookings/pnr/{pnr}` | Public | PNR status lookup |
| PUT | `/bookings/{id}/cancel` | Bearer | Cancel + trigger refund |
| PUT | `/bookings/{id}/payment` | Bearer | Confirm payment |

Interactive docs available at `http://localhost:8000/docs`

---

## 🧪 Key Scenarios to Test

```bash
# 1. Concurrent booking (race condition test)
# Open two browser tabs, both on the same train/class with 1 seat left
# Book simultaneously — only one should confirm, other goes to RAC/WL

# 2. Idempotency
curl -X POST http://localhost:8000/bookings \
  -H "X-Idempotency-Key: test-key-123" \
  -H "Authorization: Bearer TOKEN" \
  -d '{...booking data...}'
# Send the exact same request twice — should return same PNR both times

# 3. Intermediate stop search
# Train runs HWH → BWN → DGR → ASN
# Search BWN → DGR — should return the train
# Search HWH → ASN — should return the train

# 4. Cache invalidation
# Search NDLS → CSTM — note seat count (e.g. 64)
# Book 2 seats
# Search again — should show 62 (not 64 from stale cache)

# 5. Rate limiting
for i in {1..12}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/bookings ...
done
# Requests 11+ return 429 Too Many Requests
```

---

## ⚙️ Environment Variables

```bash
# PostgreSQL
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/train_booking

# JWT
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Redis
REDIS_URL=redis://127.0.0.1:6379/0
CACHE_TTL_SECONDS=300
SEAT_CACHE_TTL=60
SEARCH_CACHE_TTL=300

# RabbitMQ / Celery
RABBITMQ_URL=amqp://user:pass@127.0.0.1:5672/vhost
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1

# Elasticsearch
ELASTICSEARCH_URL=http://127.0.0.1:9200
ES_TRAINS_INDEX=trains
ES_STATIONS_INDEX=stations

# Email (Mailtrap for dev)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
EMAIL_FROM=noreply@railbook.com
```

---

## 📊 System Health Check

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "level": 3,
  "services": {
    "redis": true,
    "elasticsearch": true
  }
}
```

---

## 🎯 What This Project Demonstrates

| Concept | Implementation |
|---|---|
| **Concurrency safety** | `SELECT FOR UPDATE` prevents double booking under parallel requests |
| **Cache strategy** | Read-through cache with targeted invalidation on write |
| **Async architecture** | Celery + RabbitMQ decouples HTTP response from I/O-heavy tasks |
| **Search relevance** | Multi-field ES query with field boosting (`train_name^3`) and fuzzy matching |
| **Idempotency** | Safe retries via client-generated keys + UNIQUE DB constraint |
| **Clean architecture** | Repository pattern separates data access from business logic |
| **Schema evolution** | Alembic migrations — zero-downtime schema changes |
| **Rate limiting** | Sliding window algorithm using Redis sorted sets |
| **Token revocation** | JWT blacklist in Redis with auto-expiry matching token TTL |
| **Partial refunds** | Time-based refund policy matching real IRCTC rules |
| **Waitlist cascade** | Priority queue promotion with async notifications |
| **Type safety** | Pydantic v2 on backend, TypeScript on frontend, shared contract |
| **Admin panel** | Role-based access, train/station management, system monitoring |

---

## 🛣️ Build Progression (Levels)

This project was built incrementally, each level introducing a new production concern:

| Level | Focus | Key additions |
|---|---|---|
| **Level 1** | Monolith foundation | FastAPI + PostgreSQL + JWT + Booking logic + RAC/Waitlist |
| **Level 2** | Correctness | `SELECT FOR UPDATE` + Repository pattern + Alembic + Idempotency + Partial refunds |
| **Level 3** | Scale | Redis cache + Rate limiting + Celery/RabbitMQ + Elasticsearch + Async promotions |
| **Frontend** | Full product | Next.js 14 + TypeScript + Admin panel + Real-time seat display |

---

## 📄 License

MIT — feel free to use this as a reference or starting point.

---

<div align="center">

Built with genuine curiosity about how production systems handle the hard problems.

**Every bug in this repo was a real bug. Every fix was a real lesson.**

</div>
