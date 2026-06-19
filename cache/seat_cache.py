from typing import Optional, Dict, Any
from cache.redis_client import r, cache_set, cache_get, cache_delete_pattern
from config import settings

SEAT_PREFIX = 'seats'

def _seat_key(train_id: str, seat_class_id: str, journey_date: str) -> str:
    """Canonical Redis key for one seat class on one date."""
    return f'{SEAT_PREFIX}:{train_id}:{seat_class_id}:{journey_date}'

def get_cached_seat_availability(
    train_id: str,
    seat_class_id: str,
    journey_date: str,
) -> Optional[Dict[str, Any]]:
    """
    Return cached seat counts or None on miss.
    Callers fall back to a Postgres query on None.
    """
    key = _seat_key(train_id, seat_class_id, journey_date)
    return cache_get(key)

def set_cached_seat_availability(
    train_id: str,
    seat_class_id: str,
    journey_date: str,
    data: Dict[str, Any],
) -> None:
    """
    Store seat availability snapshot in Redis.
    data should be a plain dict — e.g.
    {
        'available_seats': 42,
        'rac_available': 8,
        'current_waitlist': 3,
        'waitlist_quota': 50,
    }
    """
    key = _seat_key(train_id, seat_class_id, journey_date)
    cache_set(key, data, ttl=settings.CACHE_TTL_SECONDS)

def invalidate_seat_cache(
    train_id: str,
    seat_class_id: str = '*',
    journey_date: str = '*',
) -> None:
    """
    Bust seat cache after a booking or cancellation.
    Defaults invalidate ALL dates and classes for a train.
    For a precise invalidation pass specific seat_class_id + journey_date.
    """
    pattern = f'{SEAT_PREFIX}:{train_id}:{seat_class_id}:{journey_date}'
    cache_delete_pattern(pattern)

def build_seat_snapshot(seat_class) -> Dict[str, Any]:
    """
    Convert a SeatClass ORM object to a plain dict for caching.
    Call this immediately after querying Postgres.
    """
    return {
        'available_seats': seat_class.available_seats,
        'rac_available': seat_class.rac_available,
        'current_waitlist': seat_class.current_waitlist,
        'waitlist_quota': seat_class.waitlist_quota,
        'total_seats': seat_class.total_seats,
        'class_type': seat_class.class_type.value,
    }