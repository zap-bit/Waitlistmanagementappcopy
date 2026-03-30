from __future__ import annotations

from math import ceil

from app.errors import ApiError
from app.models import (
    DashboardResponse,
    EntryStatus,
    EntryType,
    Event,
    EventCreate,
    EventType,
    PromoteRequest,
    SeatRequest,
    Table,
    WaitlistCreate,
    WaitlistEntry,
    now_utc,
)
from app.store import store


def create_event(payload: EventCreate) -> Event:
    event = Event(**payload.model_dump())

    if event.eventType == EventType.INDOOR_TABLES:
        total_tables = payload.totalTables or 0
        tables: list[Table] = []
        for i in range(total_tables):
            tables.append(Table(id=i + 1, name=f"Table {i+1}", capacity=4, row=i // 4, col=i % 4))
        event.tables = tables

    store.events[event.id] = event
    store.waitlists[event.id] = []
    return event


def get_event(event_id: str) -> Event:
    event = store.events.get(event_id)
    if not event:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "Event not found", {"eventId": event_id})
    return event

def get_real_time_no_show_rate(event_id: str) -> float:
    entries = store.waitlists.get(event_id, [])
    finished = [e for e in entries if e.status in {EntryStatus.SEATED, EntryStatus.NO_SHOW}]
    
    if len(finished) < 5:  
        event = get_event(event_id)
        return getattr(event, 'historical_no_show_rate', 0.15) 

    no_shows = sum(1 for e in finished if e.status == EntryStatus.NO_SHOW)
    return no_shows / len(finished)

def update_event_service_time(event_id: str):
    event = get_event(event_id)
    entries = store.waitlists.get(event_id, [])
    
    seated_entries = [e for e in entries if e.status == EntryStatus.SEATED]
    
    if not seated_entries:
        return 

    elapsed_time = (now_utc() - event.startTime).total_seconds() / 60
    
    if elapsed_time < 1:
        return

    new_avg = elapsed_time / len(seated_entries)
    
    event.avg_service_time = max(2, min(60, round(new_avg, 1)))

def get_user_weight(entry: WaitlistEntry) -> float:
    now = now_utc()
    minutes_stale = (now - entry.lastActiveTime).total_seconds() / 60
    
    grace_period = max(20, min(90, entry.estimatedWait * 0.5))

    if minutes_stale <= grace_period:
        weight = 1.0 
    elif minutes_stale >= (grace_period + 20):
        weight = 0.1
    else:
        weight = 1.0 - (0.9 * (minutes_stale - grace_period) / 20)
    
    if entry.interactionCount > 5:
        weight = min(1.0, weight + 0.1) 

    return round(weight, 2)

def calculate_heuristic_wait(event_id: str) -> int:
    event = get_event(event_id)
    entries = store.waitlists.get(event_id, [])
    queue = [e for e in entries if e.status == EntryStatus.QUEUED]
    
    if not queue:
        return 0

    weighted_count = sum(get_user_weight(e) for e in queue)

    no_show_rate = get_real_time_no_show_rate(event_id)
    adjusted_count = weighted_count * (1 - no_show_rate)

    service_time = getattr(event, 'avg_service_time', 10) or 10
    
    return ceil(adjusted_count * service_time)

def update_user_activity(event_id: str, entry_id: str):
    entry = get_waitlist_entry(event_id, entry_id)
    entry.interactionCount += 1
    entry.lastActiveTime = now_utc()
    entry.isHighRisk = False # Reset risk since they just interacted

def mark_no_show(event_id: str, entry_id: str) -> WaitlistEntry:
    get_event(event_id)
    entry = get_waitlist_entry(event_id, entry_id)

    if entry.status not in {EntryStatus.NOTIFIED, EntryStatus.QUEUED}:
        raise ApiError(409, "INVALID_INPUT", "Only queued or notified guests can be marked as No-Show")

    entry.status = EntryStatus.NO_SHOW
    
    return entry

def add_waitlist_entry(event_id: str, payload: WaitlistCreate) -> WaitlistEntry:
    get_event(event_id)
    entries = store.waitlists[event_id]

    if any(e.name.lower() == payload.name.lower() and e.status in {EntryStatus.QUEUED, EntryStatus.NOTIFIED} for e in entries):
        raise ApiError(409, "ALREADY_EXISTS", "Guest already on waitlist")

    position = sum(1 for e in entries if e.status == EntryStatus.QUEUED) + 1
    estimated_wait = max(5, position * 8)
    entry = WaitlistEntry(
        eventId=event_id,
        name=payload.name,
        partySize=payload.partySize,
        type=payload.type,
        position=position,
        estimatedWait=estimated_wait,
    )
    entries.append(entry)
    return entry


def get_waitlist_entry(event_id: str, entry_id: str) -> WaitlistEntry:
    get_event(event_id)
    for entry in store.waitlists[event_id]:
        if entry.id == entry_id:
            return entry
    raise ApiError(404, "RESOURCE_NOT_FOUND", "Entry not found", {"eventId": event_id, "entryId": entry_id})


def list_waitlist(event_id: str, page: int, page_size: int, type_filter: EntryType | None, status: EntryStatus | None) -> dict:
    get_event(event_id)
    entries = store.waitlists[event_id]
    filtered = [e for e in entries if (type_filter is None or e.type == type_filter) and (status is None or e.status == status)]
    start = (page - 1) * page_size
    data = filtered[start : start + page_size]
    return {"data": data, "page": page, "pageSize": page_size, "total": len(filtered), "totalPages": ceil(len(filtered) / page_size) if filtered else 0}


def get_dashboard(event_id: str) -> DashboardResponse:
    event = get_event(event_id)
    entries = store.waitlists[event_id]
    seated = [e for e in entries if e.status == EntryStatus.SEATED]
    occupancy = sum(e.partySize for e in seated)
    available_tables = None
    if event.eventType == EventType.INDOOR_TABLES:
        available_tables = sum(1 for t in event.tables if not t.occupied)

    return DashboardResponse(
        eventId=event_id,
        occupancy=occupancy,
        maxCapacity=event.maxCapacity,
        queuedReservations=sum(1 for e in entries if e.status == EntryStatus.QUEUED and e.type == EntryType.reservation),
        queuedWaitlist=sum(1 for e in entries if e.status == EntryStatus.QUEUED and e.type == EntryType.waitlist),
        availableTables=available_tables,
        recentActivity=[{"entryId": e.id, "name": e.name, "status": e.status} for e in entries[-5:]],
    )


def _best_table(event: Event, party_size: int, preferred_table_id: int | None = None) -> Table | None:
    tables = [t for t in event.tables if not t.occupied and t.capacity >= party_size]
    if preferred_table_id is not None:
        for table in tables:
            if table.id == preferred_table_id:
                return table
    return sorted(tables, key=lambda t: t.capacity)[0] if tables else None


def promote(event_id: str, payload: PromoteRequest) -> dict:
    event = get_event(event_id)
    entries = store.waitlists[event_id]
    queue = [e for e in entries if e.status == EntryStatus.QUEUED]
    if payload.type:
        queue = [e for e in queue if e.type == payload.type]

    promoted: list[WaitlistEntry] = []
    for entry in queue[: payload.count]:
        if event.eventType == EventType.INDOOR_TABLES:
            table = _best_table(event, entry.partySize)
            if not table:
                raise ApiError(409, "NO_CAPACITY", "No table available for current queue")
            table.occupied = True
            entry.assignedTableId = table.id
        entry.status = EntryStatus.NOTIFIED
        promoted.append(entry)

    return {"promoted": promoted, "count": len(promoted)}


def seat(event_id: str, payload: SeatRequest) -> WaitlistEntry:
    event = get_event(event_id)
    entry = get_waitlist_entry(event_id, payload.entryId)

    if entry.status not in {EntryStatus.NOTIFIED, EntryStatus.QUEUED}:
        raise ApiError(409, "INVALID_INPUT", "Only queued/notified guests can be seated")

    if event.eventType == EventType.INDOOR_TABLES:
        table = _best_table(event, entry.partySize, payload.tableId)
        if not table:
            raise ApiError(409, "TABLE_OCCUPIED", "Requested table unavailable")
        table.occupied = True
        entry.assignedTableId = table.id

    entry.status = EntryStatus.SEATED
    update_event_service_time(event_id)
    return entry
