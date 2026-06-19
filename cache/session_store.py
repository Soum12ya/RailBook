from cache.redis_client import r
from config import settings

BLACKLIST_PREFIX = 'bl:'

def blacklist_token(token: str, expires_in_seconds: int = None) -> None:
    """
    Add a JWT to the revocation blacklist.
    The Redis key auto-expires when the token would have expired anyway.
    """
    # ── FIX: Wrap the setting in int() BEFORE multiplying by 60 ──
    ttl = expires_in_seconds or (int(settings.ACCESS_TOKEN_EXPIRE_MINUTES) * 60)
    
    safe_ttl = max(1, int(ttl))
    
    r.setex(f'{BLACKLIST_PREFIX}{token}', safe_ttl, '1')

def is_token_blacklisted(token: str) -> bool:
    """Return True if this token has been revoked (user logged out)."""
    return r.exists(f'{BLACKLIST_PREFIX}{token}') > 0