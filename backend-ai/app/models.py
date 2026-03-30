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


class NotificationPreferences(BaseModel):
    sms: bool = False
    push: bool = False


class EventCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    eventType: EventType
    maxCapacity: int = Field(gt=0)
    startTime: datetime
    endTime: datetime
    totalTables: int | None = Field(default=None, gt=0)
    totalSeats: int | None = Field(default=None, gt=0)
    offlineEnabled: bool = True

    @model_validator(mode="after")
    def validate_by_type(self) -> "EventCreate":
        if self.endTime <= self.startTime:
            raise ValueError("endTime must be after startTime")

        if self.eventType == EventType.INDOOR_TABLES and self.totalTables is None:
            raise ValueError("totalTables is required for INDOOR_TABLES")
        if self.eventType == EventType.INDOOR_SEATED and self.totalSeats is None:
            raise ValueError("totalSeats is required for INDOOR_SEATED")
        return self


class Table(BaseModel):
    id: int
    name: str
    capacity: int
    row: int
    col: int
    occupied: bool = False


class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    eventType: EventType
    maxCapacity: int
    startTime: datetime
    endTime: datetime
    totalTables: int | None = None
    totalSeats: int | None = None
    offlineEnabled: bool = True
    createdAt: datetime = Field(default_factory=now_utc)
    tables: list[Table] = Field(default_factory=list)

    model_config = ConfigDict(use_enum_values=True)
    reservation_duration: int | None = 45 
    avg_service_time: int | None = 10     


class WaitlistCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    partySize: int = Field(gt=0)
    type: EntryType = EntryType.waitlist
    phoneNumber: str | None = None
    specialRequests: str | None = None
    notificationPreferences: NotificationPreferences = Field(default_factory=NotificationPreferences)


class WaitlistEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    eventId: str
    name: str
    partySize: int
    type: EntryType
    status: EntryStatus = EntryStatus.QUEUED
    position: int
    estimatedWait: int
    joinedAt: datetime = Field(default_factory=now_utc)
    assignedTableId: int | None = None
    interactionCount: int = 0
    lastActiveTime: datetime = Field(default_factory=now_utc)
    isHighRisk: bool = False


class DashboardResponse(BaseModel):
    eventId: str
    occupancy: int
    maxCapacity: int
    queuedReservations: int
    queuedWaitlist: int
    availableTables: int | None = None
    recentActivity: list[dict[str, Any]] = Field(default_factory=list)


class PromoteRequest(BaseModel):
    count: int = Field(default=1, gt=0, le=20)
    type: EntryType | None = None


class SeatRequest(BaseModel):
    entryId: str
    tableId: int | None = None
    reason: str | None = None


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthLoginResponse(BaseModel):
    token: str
    expiresIn: int = 86400
    role: str = "staff"


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


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
    timestamp: datetime = Field(default_factory=now_utc)
    requestId: str
