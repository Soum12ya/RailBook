import json
from typing import Optional, Any
import redis
from config import settings

# Mmodule-level connection pool - shared across all workers in same process
r = redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=20,
    socket_timeout=2,
    socket_connect_timeout=2,
)

def cache_set(key: str, value: Any, ttl: int = None) -> None:
    """Serialize value as JSON and store in Redis with optional ttl."""
    serialized = json.dumps(value)
    if ttl:
        r.setex(key, ttl, serialized)
    else:
        r.set(key, serialized)

def cache_get(key: str) -> Optional[Any]:
    """Retrieve and deserialize a chache value. Returns None on miss."""
    raw = r.get(key)
    if raw is None:
        return None
    return json.loads(raw)

def cache_delete(key: str) -> None:
    """Remove a key from the cache."""
    r.delete(key)

def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a pattern. Use carefully - O(N) scan."""
    cursor = 0
    while True:
        cursor, keys = r.scan(cursor=cursor, match=pattern, count=100)
        if keys:
            r.delete(*keys)
        if cursor == 0:
            break    

# -- Canonical key builders ----------------------------------
def trains_search_key(src: str, dest: str, date: str, cls= '') -> str:
    return f'search:{src}:{dest}:{date}:{cls}'

def train_detail_key(train_id: str) -> str:
    return f'train:{train_id}'       