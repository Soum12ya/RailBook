"""
routers/auth.py — Authentication endpoints

POST /auth/register  → create a new user account
POST /auth/login     → exchange email+password for a JWT
GET  /auth/me        → get the logged-in user's profile
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserCreate, UserResponse, Token, MessageResponse
from services.auth_service import hash_password, create_access_token, decode_token, authenticate_user
from cache.session_store import is_token_blacklisted, blacklist_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

# OAuth2PasswordBearer tells FastAPI where clients send the token.
# When a route has `Depends(get_current_user)`, FastAPI reads the
# Authorization: Bearer <token> header automatically.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Invalid or expired token',
        headers={'WWW-Authenticate': 'Bearer'},
    )
    
    # ── Level 3 addition: reject revoked/logged-out tokens ──
    if is_token_blacklisted(token):
        raise exc
        
    # ── Level 1/2 logic ──
    user_id = decode_token(token)
    if not user_id:
        raise exc
        
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise exc
        
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency for admin-only endpoints."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.

    Checks:
      - Email is not already registered
      - Phone is not already registered
    Then hashes the password with bcrypt and creates the user record.
    Returns a JWT token so the user is immediately logged in.
    """
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    if db.query(User).filter(User.phone == user_data.phone).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already registered",
        )

    user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=hash_password(user_data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Login with email + password.

    We use OAuth2PasswordRequestForm so the endpoint is compatible with
    the OpenAPI "Authorize" button in the Swagger docs — very handy for testing.

    The form sends `username` (we treat it as email) and `password`.
    """
    user = authenticate_user(db, email=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently logged-in user."""
    return current_user

# ── ADDED: New Level 3 Logout Endpoint ──────────────────────────────
@router.post('/logout', response_model=MessageResponse)
def logout(token: str = Depends(oauth2_scheme)):
    """
    Revoke the current JWT. Subsequent requests with this token
    return 401 even if the token has not yet expired.
    """
    blacklist_token(token)
    return {'message': 'Logged out successfully'}