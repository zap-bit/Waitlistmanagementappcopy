from __future__ import annotations

import os


def _split_csv(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


class Settings:
    app_name: str = os.getenv("APP_NAME", "Waitlist Management API")
    app_version: str = os.getenv("APP_VERSION", "1.0.0")
    allow_origins: list[str] = _split_csv(os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"))


settings = Settings()
