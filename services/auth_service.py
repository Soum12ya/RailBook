"""
services/auth_service.py — Authentication helpers

Concepts covered here:
  - Password hashing: bcrypt is a one-way hash with a random salt baked in.
    Never compare passwords directly — always verify_hash(plain, hashed).
  - JWT (JSON Web Token): a signed, self-contained token the client stores
    and sends with each request. The server validates the signature — it
    doesn't need to look up a sessions table.
  - Token payload: we only store user_id + expiry (sub + exp).
    Never put sensitive data (password, credit card) inside a JWT.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from models import User
import bcrypt

# Import your new Level 3 blacklist checker
from cache.session_store import is_token_blacklisted

# CryptContext manages the hashing algorithm. bcrypt is the industry standard —
# it's intentionally slow (to resist brute-force attacks) and adds a random salt.


def hash_password(plain: str) -> str:
    """Hash a plain password using bcrypt directly."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    """
    Create a JWT access token.

    Payload:
      sub  → subject (user_id)
      exp  → expiry timestamp (UTC)

    The token is signed with our SECRET_KEY using the HS256 algorithm.
    Anyone who has the secret key can verify the token, but only the server
    should ever have it.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=int(settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """
    Decode a JWT and return the user_id (sub claim).
    Returns None if the token is invalid, expired, or blacklisted.
    """
    # ── Level 3 addition: Fail immediately if token is revoked ──
    if is_token_blacklisted(token):
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except JWTError:
        return None


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Look up the user by email and verify their password.
    Returns the User object on success, None on failure.

    Note: We always call verify_password even if the user doesn't exist,
    to prevent timing attacks (an attacker timing the response could tell
    whether an email is registered).
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Run the hash anyway to maintain constant timing
        verify_password("dummy", "$2b$12$dummy_hash_to_prevent_timing")
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user