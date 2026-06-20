# 🚆 RailBook — Production-Grade Train Ticket Booking Platform

<p align="center">
  <strong>Full-Stack Train Reservation System Inspired by IRCTC</strong>
</p>

<p align="center">
  Next.js • FastAPI • PostgreSQL • Redis • RabbitMQ • Celery • Elasticsearch
</p>

---

## 📌 Overview

RailBook is a production-oriented train ticket booking platform designed to simulate the challenges faced by real-world reservation systems.

Unlike typical CRUD projects, RailBook focuses on:

* Preventing double booking under concurrency
* Idempotent booking operations
* Waitlist management and promotion
* Distributed caching
* Asynchronous processing
* Full-text search
* Clean Architecture principles
* Production deployment practices

The project demonstrates how modern large-scale booking platforms are designed and implemented using industry-standard technologies.

---

# 🚀 Live Architecture

```text
                    ┌─────────────────┐
                    │   Next.js App   │
                    │ React + TS      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ FastAPI Backend │
                    │ Python 3.11     │
                    └───────┬─────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ PostgreSQL  │    │    Redis    │    │Elasticsearch│
│ Source Truth│    │ Cache Layer │    │ Search Layer│
└─────────────┘    └─────────────┘    └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │ RabbitMQ    │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │ Celery      │
                    │ Workers     │
                    └─────────────┘
```

---

# ✨ Core Features

## User Features

* User Registration & Login
* JWT Authentication
* Train Search
* Station Search
* Seat Availability Check
* Ticket Booking
* PNR Status Tracking
* Booking History
* Ticket Cancellation
* Waitlist Management
* Refund Calculation

---

## Admin Features

* Train Management
* Station Management
* Booking Monitoring
* Seat Inventory Management
* Operational Dashboard

---

# 🏗 System Design Highlights

## 1. Double Booking Prevention

One of the most difficult problems in ticketing systems is ensuring that two users cannot reserve the last available seat simultaneously.

RailBook solves this using:

```sql
SELECT ...
FOR UPDATE
```

### Why?

Without locking:

```text
User A reads seats = 1
User B reads seats = 1

User A books seat
User B books seat

Result:
2 confirmed bookings
1 physical seat
```

With PostgreSQL Row-Level Locking:

```text
User A acquires lock
User B waits

User A books seat
Commit

User B reads updated value
Seats = 0

Booking denied
```

This guarantees seat consistency even under concurrent requests.

---

## 2. Idempotent Booking API

Network failures should never create duplicate bookings.

Every booking request supports:

```http
X-Idempotency-Key: UUID
```

If a request is retried:

```text
Client Retry
      ↓
Same Idempotency Key
      ↓
Existing Booking Returned
      ↓
No Duplicate Ticket
```

---

## 3. Waitlist Promotion Cascade

When a confirmed ticket is cancelled:

```text
WAITLIST-1 → RAC
RAC → CONFIRMED
```

Promotion occurs automatically while preserving booking order.

---

## 4. Clean Architecture

```text
Router Layer
      ↓
Service Layer
      ↓
Repository Layer
      ↓
Database Layer
```

### Benefits

* Easier testing
* Better maintainability
* Separation of concerns
* Enterprise-ready code organization

---

# ⚙️ Tech Stack

## Frontend

* Next.js 14
* React
* TypeScript
* Tailwind CSS
* Zustand

## Backend

* Python 3.11
* FastAPI
* SQLAlchemy 2
* Pydantic v2
* Alembic

## Database

* PostgreSQL

## Caching

* Redis

## Messaging

* RabbitMQ

## Async Processing

* Celery

## Search

* Elasticsearch

## Authentication

* JWT
* bcrypt

---

# 📦 Database Design

Core Entities:

```text
Users
Stations
Trains
TrainStops
SeatClasses
Bookings
Passengers
```

Relationships:

```text
User
 │
 ├── Bookings
 │       │
 │       └── Passengers

Train
 │
 ├── Stops
 │
 └── Seat Classes
```

---

# 🔥 Production Features

## Redis

Used for:

* Search caching
* Seat availability cache
* Session blacklist
* Rate limiting

Benefits:

```text
10x–50x fewer DB reads
Sub-millisecond access
Improved API latency
```

---

## RabbitMQ + Celery

Background Tasks:

* Booking confirmation emails
* Cancellation notifications
* Waitlist promotion jobs

Benefits:

```text
HTTP response remains fast
Heavy work moved off request path
Better scalability
```

---

## Elasticsearch

Supports:

* Partial search
* Typo tolerance
* Fast station lookup
* Full-text train search

Example:

```text
mumbi
```

returns:

```text
Mumbai
```

---

# 📈 Scalability Roadmap

## Level 1

Monolithic Booking System

* FastAPI
* PostgreSQL

---

## Level 2

Concurrency Safe

* SELECT FOR UPDATE
* Repository Pattern
* Waitlist Promotion
* Idempotency
* Alembic

---

## Level 3

Production Ready

* Redis
* RabbitMQ
* Celery
* Elasticsearch

---

## Future Improvements

### Payments

* Stripe Integration
* Webhook Verification

### Real-Time Updates

* WebSockets
* Live Seat Availability

### Monitoring

* Prometheus
* Grafana

### Distributed Scaling

* Kubernetes
* Redis Distributed Locks
* PgBouncer

---

# 🧪 Testing

Backend

```bash
pytest
```

Frontend

```bash
npm test
```

Build

```bash
npm run build
```

---

# 🔒 Security

Implemented:

* JWT Authentication
* Password Hashing (bcrypt)
* Token Expiration
* Redis JWT Blacklist
* Input Validation
* SQL Injection Protection via ORM

Future:

* RBAC
* OAuth2
* Audit Logs

---

# 🚀 Deployment

Frontend

* Vercel

Backend

* Railway

Services

* PostgreSQL
* Redis
* RabbitMQ
* Elasticsearch

Environment variables are managed securely using deployment platform secrets.

---

# 🎯 What This Project Demonstrates

This project demonstrates practical understanding of:

* Backend Engineering
* Distributed Systems
* Database Design
* Concurrency Control
* API Design
* Caching
* Asynchronous Processing
* Search Infrastructure
* System Design
* Production Deployment

Rather than being a CRUD application, RailBook focuses on solving real-world engineering problems encountered in high-traffic reservation systems.

---

## 👨‍💻 Author

**Soumyajit Bhandary**

Machine Learning • Data Engineering • Backend Systems • AI Applications

Built as a system-design-focused project to explore production-grade booking architecture and scalability patterns.
