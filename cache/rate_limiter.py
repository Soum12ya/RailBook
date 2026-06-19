import time
from fastapi import Request, HTTPException, status
from cache.redis_client import r

class SlidingWindowRateLimiter:
    """
    Sliding-Window rate limiter using a Redis sorted set.
    Each identifier gets key: ratelimit: {identifier}
    Members are request timestamps; scores are the same timestamps.
    """
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def is_allowed(self, identifier: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        key = f'ratelimit:{identifier}'

        pipe  =r.pipeline(transaction=True)
        # 1. Remove timestamps outside the window
        pipe.zremrangebyscore(key, 0, window_start)
        # 2. Add this request
        pipe.zadd(key, {str(now): now})
        # 3. Count requests in window
        pipe.zcard(key)
        # 4. Auto-expire the key
        pipe.expire(key, self.window_seconds + 1)
        results = pipe.execute()
        count = results[2]
        return count <= self.max_requests

# ---- Pre-built limiters ----------------------------------
booking_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60)
search_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)
auth_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60)

def rate_limit(limiter: SlidingWindowRateLimiter):
    """
    FastAPI dependency factory - returns a callable FastAPI can inject.
    Usage in a router: Depends(rate limit(booking limiter))
    """
    def check(request: Request):
        identifier = request.client.host or  'unknown'
        if not limiter.is_allowed(identifier):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail='Rate limit exceeded. Please retry after waiting.',
                headers={'Retry-After': str(limiter.window_seconds)},
            )
    return check