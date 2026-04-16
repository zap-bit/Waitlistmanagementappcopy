from __future__ import annotations
from fastapi import Header, Depends
from app.errors import ApiError
from app.store import supabase
import os

DEMO_BEARER = os.getenv("DEMO_BEARER", "")
DEMO_API_KEY = os.getenv("DEMO_API_KEY", "")

def require_auth(
    authorization: str | None = Header(default=None), 
    x_api_key: str | None = Header(default=None)
) -> None:
    if x_api_key == DEMO_API_KEY:
        return
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if token == DEMO_BEARER:
            return
        try:
            user = supabase.auth.get_user(token)
            if user:
                return
        except Exception:
            pass 

    raise ApiError(401, "UNAUTHORIZED", "Missing or invalid authentication")