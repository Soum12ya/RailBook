from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import models
from database import engine
from routers import auth, trains, bookings
from cache.redis_client import r as redis_r
from search.es_client import es, create_indices

# Create DB tables (Note: In future updates, you'd use Alembic for migrations instead)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title='Train Ticket Booking API',
    description='Level 3 — Redis + Celery + Elasticsearch',
    version='3.0.0',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'], 
    allow_credentials=True,
    allow_methods=['*'], 
    allow_headers=['*'],
)

@app.on_event('startup')
async def startup_event():
    # Verify Redis connectivity on startup
    try:
        redis_r.ping()
        print('[startup] Redis connected')
    except Exception as e:
        print(f'[startup] WARNING: Redis unavailable — {e}')
        
    # Verify ES connectivity + idempotently create indices
    try:
        es.ping()
        create_indices() 
        print('[startup] Elasticsearch connected + indices ready')
    except Exception as e:
        print(f'[startup] WARNING: Elasticsearch unavailable — {e}')

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[Unhandled Exception]: {exc}")  # Helpful for terminal debugging
    return JSONResponse(
        status_code=500, 
        content={'detail': 'An internal error occurred.'}
    )

# Register routers
app.include_router(auth.router)
app.include_router(trains.router)
app.include_router(bookings.router)

@app.get('/health', tags=['System'])
def health_check():
    """Checks the health of the DB, Redis, and Elasticsearch."""
    redis_ok = False
    es_ok = False  
    
    try: 
        redis_r.ping()
        redis_ok = True
    except Exception: 
        pass
        
    try: 
        es.ping()
        es_ok = True
    except Exception: 
        pass
        
    return {
        'status': 'ok' if (redis_ok and es_ok) else 'degraded',
        'level': 3,
        'services': {
            'redis': redis_ok, 
            'elasticsearch': es_ok
        },
    }

@app.get('/', tags=['System'])
def root():
    return {'message': 'Train Booking API Level 3', 'docs': '/docs'}