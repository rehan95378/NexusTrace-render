from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..auth import create_access_token, get_user_from_token

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginIn):
    """Demo login — accepts anything and returns a JWT. Replace with a real
    user store + bcrypt verification before the hackathon demo."""
    if not body.email or not body.password:
        raise HTTPException(400, "email and password required")
    return {"access_token": create_access_token(body.email), "token_type": "bearer"}


@router.get("/me")
def me(user=Depends(get_user_from_token)):
    return user