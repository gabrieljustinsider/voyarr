import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import User
from security import (
    verify_password,
    get_password_hash,
    create_access_token,
    JWT_SECRET,
    ALGORITHM,
)
from datetime import timedelta
from pydantic import BaseModel, Field
from typing import Literal
from jose import jwt, JWTError
from rate_limiter import rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    role: Literal["admin", "user", "viewer"] = "user"


@router.post(
    "/register", dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))]
)
def register_user(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    # SECURITY: Prevent unauthorized user registration
    user_count = db.query(User).count()
    if user_count > 0:
        api_key = request.headers.get("X-Voyarr-Api-Key")
        auth_header = request.headers.get("Authorization")

        is_authorized = False
        master_key_env = os.getenv("MASTER_KEY")
        if api_key and master_key_env and api_key == master_key_env:
            is_authorized = True
        elif auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
                if payload.get("role") == "admin":
                    is_authorized = True
            except JWTError:
                pass

        if not is_authorized:
            raise HTTPException(
                status_code=403,
                detail="Only admins or master key holders can register new users.",
            )
    else:
        # Force the first user to be an admin to prevent system lockouts
        user.role = "admin"

    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username, password_hash=hashed_password, role=user.role
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username already registered")
    return {
        "message": "User created successfully",
        "username": db_user.username,
        "role": db_user.role,
    }


@router.post(
    "/token", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))]
)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user
