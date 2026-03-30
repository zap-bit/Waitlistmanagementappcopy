from __future__ import annotations

from fastapi import Header

from app.errors import ApiError


DEMO_BEARER = "demo-token"
DEMO_API_KEY = "demo-api-key"


def require_auth(authorization: str | None = Header(default=None), x_api_key: str | None = Header(default=None)) -> None:
    if x_api_key == DEMO_API_KEY:
        return

    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if token == DEMO_BEARER:
            return

    raise ApiError(401, "UNAUTHORIZED", "Missing or invalid authentication")
