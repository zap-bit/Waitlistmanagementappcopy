from __future__ import annotations
import atexit
from contextlib import asynccontextmanager
from fastapi import APIRouter, Depends, FastAPI, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from posthog import Posthog, new_context, identify_context
from app.auth import DEMO_BEARER, require_auth
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

auth_scheme = HTTPBearer()

posthog_client = Posthog(
    api_key=settings.posthog_api_key,
    host=settings.posthog_host,
    enable_exception_autocapture=True,
)
atexit.register(posthog_client.shutdown)

@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    posthog_client.flush()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    dependencies=[Depends(auth_scheme)]
)

async def _tracking_error_handler(request: Request, exc: ApiError):
    if exc.status_code == 401:
        posthog_client.capture(
            "auth failed",
            distinct_id="anonymous",
            properties={"path": request.url.path},
        )
    return await api_error_handler(request, exc)

app.add_exception_handler(ApiError, _tracking_error_handler)

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
def login(
    payload: AuthLoginRequest,
    x_posthog_distinct_id: str | None = Header(default=None),
) -> AuthLoginResponse:
    _ = payload
    result = AuthLoginResponse(token=DEMO_BEARER)
    distinct_id = x_posthog_distinct_id or "staff-anonymous"
    with new_context():
        identify_context(distinct_id)
        posthog_client.capture("staff logged in", distinct_id=distinct_id)
    return result

@router.post("/events", dependencies=[Depends(require_auth)])
def create_event_endpoint(payload: EventCreate):
    return create_event(payload, posthog_client)

@router.get("/events/{event_id}", dependencies=[Depends(require_auth)])
def get_event_endpoint(event_id: str):
    return get_event(event_id)

@router.post("/events/{event_id}/waitlist")
def join_waitlist_endpoint(
    event_id: str,
    payload: WaitlistCreate,
    x_posthog_distinct_id: str | None = Header(default=None),
    x_posthog_session_id: str | None = Header(default=None),
):
    return add_waitlist_entry(event_id, payload, posthog_client, x_posthog_distinct_id, x_posthog_session_id)

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
def get_entry_endpoint(
    event_id: str,
    entry_id: str,
    x_posthog_distinct_id: str | None = Header(default=None),
):
    result = get_waitlist_entry(event_id, entry_id)
    distinct_id = x_posthog_distinct_id or entry_id
    with new_context():
        identify_context(distinct_id)
        posthog_client.capture(
            "waitlist entry viewed",
            distinct_id=distinct_id,
            properties={"event_id": event_id, "entry_id": entry_id},
        )
    return result

@router.get("/events/{event_id}/staff/dashboard", dependencies=[Depends(require_auth)])
def dashboard_endpoint(
    event_id: str,
    x_posthog_distinct_id: str | None = Header(default=None),
):
    calculate_heuristic_wait(event_id)
    result = get_dashboard(event_id)
    distinct_id = x_posthog_distinct_id or "staff-anonymous"
    with new_context():
        identify_context(distinct_id)
        posthog_client.capture(
            "dashboard viewed",
            distinct_id=distinct_id,
            properties={"event_id": event_id},
        )
    return result

@router.post("/events/{event_id}/staff/promote", dependencies=[Depends(require_auth)])
def promote_endpoint(event_id: str, payload: PromoteRequest):
    return promote(event_id, payload, posthog_client)

@router.post("/events/{event_id}/staff/seat", dependencies=[Depends(require_auth)])
def seat_endpoint(event_id: str, payload: SeatRequest):
    return seat(event_id, payload, posthog_client)

@router.post("/sync", dependencies=[Depends(require_auth)])
def sync_endpoint(
    payload: SyncRequest,
    x_posthog_distinct_id: str | None = Header(default=None),
):
    conflicts: list[dict] = []
    for op in payload.operations:
        if op.conflictResolution is None:
            conflicts.append(
                {
                    "resource": op.resource,
                    "resourceId": op.resourceId,
                    "resolution": "SERVER_WINS",
                }
            )

    result = {
        "deviceId": payload.deviceId,
        "syncTimestamp": payload.syncTimestamp,
        "processed": len(payload.operations),
        "conflicts": conflicts,
    }

    distinct_id = x_posthog_distinct_id or "staff-anonymous"
    with new_context():
        identify_context(distinct_id)
        posthog_client.capture(
            "sync completed",
            distinct_id=distinct_id,
            properties={
                "device_id": payload.deviceId,
                "operations_count": len(payload.operations),
                "conflicts_count": len(conflicts),
            },
        )

    return result

@router.get("/events/{event_id}/predicted-wait")
def get_predicted_wait(event_id: str):
    wait_minutes = calculate_heuristic_wait(event_id)
    return {"minutes_remaining": wait_minutes}

@router.post("/events/{event_id}/entries/{entry_id}/ping")
def ping_activity(
    event_id: str,
    entry_id: str,
    x_posthog_distinct_id: str | None = Header(default=None),
):
    update_user_activity(event_id, entry_id)
    wait_minutes = calculate_heuristic_wait(event_id)

    distinct_id = x_posthog_distinct_id or entry_id
    with new_context():
        identify_context(distinct_id)
        posthog_client.capture(
            "guest activity pinged",
            distinct_id=distinct_id,
            properties={"event_id": event_id, "entry_id": entry_id},
        )

    return {
        "status": "active",
        "current_wait_minutes": wait_minutes,
    }

@router.post("/events/{event_id}/staff/no-show", dependencies=[Depends(require_auth)])
def mark_no_show_endpoint(event_id: str, payload: SeatRequest):
    return mark_no_show(event_id, payload.entryId, posthog_client)

app.include_router(router, prefix="/v1")
app.include_router(router)
