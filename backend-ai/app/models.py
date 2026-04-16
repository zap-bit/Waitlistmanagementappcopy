from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4
from pydantic import BaseModel, ConfigDict, Field, model_validator


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class EventType(str, Enum):
    OUTDOOR = "OUTDOOR"
    INDOOR_TABLES = "INDOOR_TABLES"
    INDOOR_SEATED = "INDOOR_SEATED"
    CAPACITY = "CAPACITY"


class EntryType(str, Enum):
    reservation = "reservation"
    waitlist = "waitlist"


class EntryStatus(str, Enum):
    QUEUED = "QUEUED"
    NOTIFIED = "NOTIFIED"
    SEATED = "SEATED"
    NO_SHOW = "NO_SHOW"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    active = "active"


class NotificationPreferences(BaseModel):
    sms: bool = False
    push: bool = False


class Table(BaseModel):
    uuid: str = Field(default_factory=lambda: str(uuid4()))
    event_uuid: str
    table_number: int
    table_capacity: int
    row_index: int
    col_index: int
    occupied: bool = False
    guest_name: str | None = None
    party_size: int | None = None
    seated_at: datetime | None = None


class EventCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    event_type: EventType
    location: str | None = None
    queue_capacity: int = Field(default=100, gt=0)
    startTime: datetime
    endTime: datetime
    num_tables: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_times(self) -> "EventCreate":
        if self.endTime <= self.startTime:
            raise ValueError("endTime must be after startTime")
        return self


class Event(BaseModel):
    uuid: str = Field(default_factory=lambda: str(uuid4()))
    account_uuid: str
    name: str
    event_type: EventType
    status: EntryStatus = EntryStatus.active
    location: str | None = None
    queue_capacity: int | None = None
    est_wait: int | None = 5
    num_tables: int | None = None
    avg_size: int | None = None
    reservation_duration: int | None = 45
    avg_service_time: int | None = 10
    created_at: datetime = Field(default_factory=now_utc)

    model_config = ConfigDict(from_attributes=True)


class WaitlistCreate(BaseModel):
    name: str
    party_size: int = Field(gt=0)
    type: EntryType = EntryType.waitlist
    special_req: str | None = None


class WaitlistEntry(BaseModel):
    uuid: str = Field(default_factory=lambda: str(uuid4()))
    event_uuid: str
    account_uuid: str
    name: str | None = None
    party_size: int
    type: EntryType | None = EntryType.waitlist
    status: str
    position: int | None = 0
    estimated_wait: int | None = 0
    joined_at: datetime = Field(default_factory=now_utc)
    special_req: str | None = None


class DashboardResponse(BaseModel):
    event_uuid: str
    current_count: int
    queue_capacity: int
    available_tables: int | None = None
    recent_activity: list[dict[str, Any]] = Field(default_factory=list)


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthLoginResponse(BaseModel):
    token: str
    expiresIn: int = 86400
    role: str = "staff"


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
    timestamp: datetime = Field(default_factory=now_utc)
    requestId: str


class Account(BaseModel):
    uuid: str
    name: str
    email: str
    password: str
    account_type: str
    business_name: str | None = None
    phone: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PromoteRequest(BaseModel):
    count: int = Field(default=1, gt=0, le=20)
    type: EntryType | None = None


class SeatRequest(BaseModel):
    entryId: str
    tableId: int | None = None
    reason: str | None = None


class SyncOperation(BaseModel):
    type: str
    resource: str
    resourceId: str
    data: dict[str, Any]
    timestamp: datetime
    conflictResolution: str | None = None


class SyncRequest(BaseModel):
    deviceId: str
    syncTimestamp: datetime
    operations: list[SyncOperation]