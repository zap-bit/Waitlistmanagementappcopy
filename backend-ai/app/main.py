from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.auth import DEMO_BEARER, require_auth
from app.bootstrap import seed_demo_data
from app.config import settings
from app.errors import ApiError, api_error_handler
from app.models import (
    AuthLoginRequest,
    AuthLoginResponse,
    EntryStatus,
    EntryType,
    EventCreate,
    PromoteRequest,
    SeatRequest,
    SyncRequest,
    WaitlistCreate,
)
from app.services import (
    add_waitlist_entry,
    create_event,
    get_dashboard,
    get_event,
    get_waitlist_entry,
    list_waitlist,   
    promote,
    seat,
    update_user_activity,   
    calculate_heuristic_wait,    
    mark_no_show,          
)



@asynccontextmanager
async def lifespan(_: FastAPI):
    seed_demo_data()
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.add_exception_handler(ApiError, api_error_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/auth/login", response_model=AuthLoginResponse)
def login(payload: AuthLoginRequest) -> AuthLoginResponse:
    _ = payload
    return AuthLoginResponse(token=DEMO_BEARER)


@router.post("/events", dependencies=[Depends(require_auth)])
def create_event_endpoint(payload: EventCreate):
    return create_event(payload)


@router.get("/events/{event_id}", dependencies=[Depends(require_auth)])
def get_event_endpoint(event_id: str):
    return get_event(event_id)


@router.post("/events/{event_id}/waitlist")
def join_waitlist_endpoint(event_id: str, payload: WaitlistCreate):
    return add_waitlist_entry(event_id, payload)


@router.get("/events/{event_id}/waitlist", dependencies=[Depends(require_auth)])
def list_waitlist_endpoint(
    event_id: str,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    type: EntryType | None = Query(default=None),
    status: EntryStatus | None = Query(default=None),
):
    return list_waitlist(event_id, page, pageSize, type, status)


@router.get("/events/{event_id}/waitlist/{entry_id}")
def get_entry_endpoint(event_id: str, entry_id: str):
    return get_waitlist_entry(event_id, entry_id)


@router.get("/events/{event_id}/staff/dashboard", dependencies=[Depends(require_auth)])
def dashboard_endpoint(event_id: str):
    return get_dashboard(event_id)


@router.post("/events/{event_id}/staff/promote", dependencies=[Depends(require_auth)])
def promote_endpoint(event_id: str, payload: PromoteRequest):
    return promote(event_id, payload)


@router.post("/events/{event_id}/staff/seat", dependencies=[Depends(require_auth)])
def seat_endpoint(event_id: str, payload: SeatRequest):
    return seat(event_id, payload)


@router.post("/sync", dependencies=[Depends(require_auth)])
def sync_endpoint(payload: SyncRequest):
    conflicts: list[dict] = []
    for op in payload.operations:
        if op.conflictResolution is None:
            conflicts.append({"resource": op.resource, "resourceId": op.resourceId, "resolution": "SERVER_WINS"})
    return {
        "deviceId": payload.deviceId,
        "syncTimestamp": payload.syncTimestamp,
        "processed": len(payload.operations),
        "conflicts": conflicts,
    }

@router.get("/events/{event_id}/predicted-wait")
def get_predicted_wait(event_id: str, _=Depends(require_auth)):
    wait_minutes = calculate_heuristic_wait(event_id)
    return {"minutes_remaining": wait_minutes}

@router.post("/events/{event_id}/entries/{entry_id}/ping")
def ping_activity(event_id: str, entry_id: str):
    update_user_activity(event_id, entry_id)
    return {"status": "active"}

@router.post("/events/{event_id}/staff/no-show", dependencies=[Depends(require_auth)])
def mark_no_show_endpoint(event_id: str, payload: SeatRequest):
    return mark_no_show(event_id, payload.entryId)


# Primary API contract: /v1/*
app.include_router(router, prefix="/v1")
# Backward-compatible aliases for clients still calling unversioned routes.
app.include_router(router)
