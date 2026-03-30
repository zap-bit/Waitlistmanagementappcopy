from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from app.models import ErrorResponse


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: dict | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    payload = ErrorResponse(
        code=exc.code,
        message=exc.message,
        details=exc.details,
        requestId=request.headers.get("x-request-id", "req-local"),
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(mode="json"))
