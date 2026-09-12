from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext

from .config import config


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)
SESSION_USER = {"id": "demo", "role": "investigator"}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    cfg = config["jwt"]
    expire = datetime.now(timezone.utc) + timedelta(minutes=cfg["expires_minutes"])
    return jwt.encode(
        {"sub": subject, "exp": expire}, cfg["secret"], algorithm=cfg["algorithm"]
    )


def get_user_from_token(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
):
    """Simple demo auth. Swap in a real user store when you wire login."""
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(creds.credentials, config["jwt"]["secret"], algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return {"id": payload.get("sub"), "role": payload.get("role", "investigator")}