from __future__ import annotations
from math import ceil
from datetime import datetime, timezone
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
from app.store import supabase
from postgrest.exceptions import APIError as SupabaseAPIError


def calculate_heuristic_wait(event_id: str) -> int:
    event = get_event(event_id)
    service_time = event.avg_service_time or 10

    party_res = (
        supabase.table("party")
        .select("*")
        .eq("event_uuid", event_id)
        .eq("status", "QUEUED")
        .execute()
    )

    queued_parties = party_res.data or []
    party_count = len(queued_parties)

    if not queued_parties:
        supabase.table("events").update({"est_wait": 0}).eq("uuid", event_id).execute()
        return 0

    party_uuids = [p["uuid"] for p in queued_parties]

    queue_res = (
        supabase.table("table_queue")
        .select("*")
        .in_("uuid", party_uuids)
        .execute()
    )

    queue_map = {q["uuid"]: q for q in queue_res.data}

    total_weighted_count = 0.0
    for party_data in queued_parties:
        q_data = queue_map.get(party_data["uuid"])
        weight = get_user_weight(party_data, q_data) if q_data else 1.0
        total_weighted_count += weight

    no_show_rate = get_real_time_no_show_rate(event_id)
    adjusted_rate = no_show_rate if no_show_rate < 1 else no_show_rate / 100.0

    final_probabilistic_count = total_weighted_count * (1 - adjusted_rate)

    estimated_minutes = ceil(final_probabilistic_count * service_time)

    try:
        supabase.table("events").update(
            {"est_wait": estimated_minutes}
        ).eq("uuid", event_id).execute()
    except Exception:
        pass

    return estimated_minutes


def get_real_time_no_show_rate(event_id: str) -> float:
    res = (
        supabase.table("party")
        .select("status")
        .eq("event_uuid", event_id)
        .in_("status", ["SEATED", "NO_SHOW"])
        .execute()
    )

    finished = res.data or []

    if len(finished) < 5:
        event = get_event(event_id)
        raw_rate = getattr(event, "no_show_rate", 15) or 15
        return raw_rate / 100.0 if raw_rate > 1 else raw_rate

    no_shows = sum(1 for e in finished if e["status"] == "NO_SHOW")
    return round(no_shows / len(finished), 2)


def get_user_weight(party_data: dict | WaitlistEntry, queue_data: dict) -> float:
    def val(obj, key, default=None):
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    now = now_utc()
    last_active_str = val(queue_data, "last_active_time")

    if not last_active_str:
        return 1.0

    last_active = datetime.fromisoformat(last_active_str.replace("Z", "+00:00"))
    minutes_stale = (now - last_active).total_seconds() / 60

    est_wait = val(party_data, "estimated_wait", 30)
    grace_period = max(20, min(90, est_wait * 0.5))

    if minutes_stale <= grace_period:
        weight = 1.0
    elif minutes_stale >= (grace_period + 20):
        weight = 0.1
    else:
        weight = 1.0 - (0.9 * (minutes_stale - grace_period) / 20)

    interactions = queue_data.get("interaction_count", 0)
    if interactions > 5:
        weight = min(1.0, weight + 0.1)

    return round(weight, 2)


def update_user_activity(event_id: str, entry_uuid: str):
    res = (
        supabase.table("table_queue")
        .select("interaction_count")
        .eq("uuid", entry_uuid)
        .single()
        .execute()
    )

    current_count = res.data.get("interaction_count", 0) if res.data else 0

    supabase.table("table_queue").update(
        {
            "last_active_time": now_utc().isoformat(),
            "interaction_count": current_count + 1,
            "high_risk": False,
        }
    ).eq("uuid", entry_uuid).execute()


def list_waitlist(
    event_id: str,
    page: int,
    page_size: int,
    type_filter: EntryType | None,
    status: EntryStatus | None,
) -> dict:
    query = (
        supabase.table("party")
        .select("*", count="exact")
        .eq("event_uuid", event_id)
    )

    if type_filter:
        query = query.eq("type", type_filter.value)
    if status:
        query = query.eq("status", status.value)

    start = (page - 1) * page_size
    end = start + page_size - 1

    res = query.order("position", desc=False).range(start, end).execute()

    total_count = res.count or 0
    data = [WaitlistEntry.model_validate(e) for e in res.data]

    return {
        "data": data,
        "page": page,
        "pageSize": page_size,
        "total": total_count,
        "totalPages": ceil(total_count / page_size) if total_count > 0 else 0,
    }


def get_dashboard(event_id: str) -> DashboardResponse:
    event = get_event(event_id)

    res = supabase.table("party").select("*").eq("event_uuid", event_id).execute()
    entries = res.data or []
    parsed_entries = [WaitlistEntry.model_validate(e) for e in entries]

    occupancy = sum(
        e.party_size for e in parsed_entries if e.status == EntryStatus.SEATED
    )

    available_tables = None
    if event.event_type == EventType.CAPACITY:
        available_tables = 0

    return DashboardResponse(
        event_uuid=event_id,
        current_count=occupancy,
        queue_capacity=event.queue_capacity or 100,
        available_tables=available_tables,
        recent_activity=[
            {"entryId": str(e.uuid), "name": e.name, "status": e.status}
            for e in parsed_entries[-5:]
        ],
    )


def _best_table(event: Event, party_size: int, preferred_table_id: int | None = None):
    if not event.tables:
        return None

    tables = [
        t for t in event.tables if not t.occupied and t.capacity >= party_size
    ]

    if preferred_table_id is not None:
        for table in tables:
            if table.id == preferred_table_id:
                return table

    return sorted(tables, key=lambda t: t.capacity)[0] if tables else None


def update_event_service_time(event_id: str):
    event = get_event(event_id)

    res = (
        supabase.table("party")
        .select("uuid", count="exact")
        .eq("event_uuid", event_id)
        .eq("status", "SEATED")
        .execute()
    )

    seated_count = int(res.count) if res.count is not None else 0
    if seated_count == 0:
        return

    start_time_raw = getattr(event, "created_at", None)
    if not start_time_raw:
        return

    if isinstance(start_time_raw, str):
        start_time = datetime.fromisoformat(
            start_time_raw.replace("Z", "+00:00")
        )
    else:
        start_time = start_time_raw

    now = datetime.now(timezone.utc)
    delta = now - start_time
    elapsed_minutes = float(delta.total_seconds() / 60)

    if elapsed_minutes < 0.5:
        return

    new_avg = elapsed_minutes / seated_count
    final_val = int(max(2, min(60, round(new_avg))))

    supabase.table("events").update(
        {"avg_service_time": final_val}
    ).eq("uuid", event_id).execute()


def mark_no_show(event_id: str, entry_id: str) -> WaitlistEntry:
    entry = get_waitlist_entry(event_id, entry_id)
    old_position = entry.position

    if entry.status not in {"NOTIFIED", "QUEUED"}:
        raise ApiError(
            409,
            "INVALID_INPUT",
            "Only queued or notified guests can be marked as No-Show",
        )

    response = (
        supabase.table("party")
        .update({"status": "NO_SHOW", "position": 0})
        .eq("uuid", entry_id)
        .execute()
    )

    if not response.data:
        raise ApiError(500, "DATABASE_ERROR", "Failed to update guest status")

    _reorder_positions(event_id, old_position)

    return WaitlistEntry.model_validate(response.data[0])


def promote(event_id: str, payload: PromoteRequest) -> dict:
    query = (
        supabase.table("party")
        .select("*")
        .eq("event_uuid", event_id)
        .eq("status", "QUEUED")
    )

    if payload.type:
        type_str = (
            payload.type.value
            if hasattr(payload.type, "value")
            else str(payload.type)
        )
        query = query.eq("type", type_str)

    res = query.order("position", desc=False).limit(payload.count).execute()

    promoted_entries = res.data
    if not promoted_entries:
        return {"promoted": [], "count": 0}

    updated_list = []
    for item in promoted_entries:
        upd = (
            supabase.table("party")
            .update({"status": "NOTIFIED"})
            .eq("uuid", item["uuid"])
            .execute()
        )
        updated_list.append(WaitlistEntry.model_validate(upd.data[0]))

    return {"promoted": updated_list, "count": len(updated_list)}


def seat(event_id: str, payload: SeatRequest) -> WaitlistEntry:
    entry = get_waitlist_entry(event_id, payload.entryId)
    old_position = entry.position

    if entry.status not in {"NOTIFIED", "QUEUED"}:
        raise ApiError(
            409,
            "INVALID_INPUT",
            "Only queued/notified guests can be seated",
        )

    response = (
        supabase.table("party")
        .update({"status": "SEATED", "position": 0})
        .eq("uuid", payload.entryId)
        .execute()
    )

    _reorder_positions(event_id, old_position)

    update_event_service_time(event_id)

    return WaitlistEntry.model_validate(response.data[0])


def get_waitlist_entry(event_id: str, entry_id: str) -> WaitlistEntry:
    try:
        response = (
            supabase.table("party")
            .select("*")
            .eq("uuid", entry_id)
            .eq("event_uuid", event_id)
            .execute()
        )

        if not response.data:
            raise ApiError(404, "RESOURCE_NOT_FOUND", "Entry not found")

        return WaitlistEntry.model_validate(response.data[0])

    except SupabaseAPIError as e:
        raise ApiError(500, "DATABASE_ERROR", str(e))


def _reorder_positions(event_id: str, removed_position: int):
    try:
        to_move = (
            supabase.table("party")
            .select("uuid", "position")
            .eq("event_uuid", event_id)
            .gt("position", removed_position)
            .in_("status", ["QUEUED", "NOTIFIED"])
            .execute()
        )

        for row in to_move.data:
            supabase.table("party").update(
                {"position": row["position"] - 1}
            ).eq("uuid", row["uuid"]).execute()

    except Exception:
        pass


def create_event(payload: EventCreate) -> Event:
    try:
        BUSINESS_ACCOUNT_ID = "4453668f-9e6a-4b9f-8828-c6ab56335597"

        event_data = {
            "account_uuid": BUSINESS_ACCOUNT_ID,
            "name": payload.name,
            "event_type": payload.event_type,
            "location": payload.location,
            "status": "active",
        }

        if payload.event_type == "CAPACITY":
            event_data.update(
                {
                    "cap_type": "SINGLE",
                    "queue_capacity": payload.queue_capacity or 100,
                    "est_wait": 15,
                    "num_tables": None,
                    "avg_size": None,
                    "reservation_duration": None,
                }
            )
        elif payload.event_type == "TABLE":
            event_data.update(
                {
                    "num_tables": payload.num_tables or 10,
                    "avg_size": 4,
                    "reservation_duration": 60,
                    "cap_type": None,
                    "queue_capacity": None,
                    "est_wait": None,
                }
            )

        response = supabase.table("events").insert(event_data).execute()
        return Event.model_validate(response.data[0])

    except SupabaseAPIError as e:
        raise ApiError(500, "DATABASE_ERROR", str(e))


def get_event(event_id: str) -> Event:
    try:
        response = (
            supabase.table("events")
            .select("*")
            .eq("uuid", event_id)
            .execute()
        )

        if not response.data:
            raise ApiError(404, "RESOURCE_NOT_FOUND", f"Event {event_id} not found")

        return Event.model_validate(response.data[0])

    except SupabaseAPIError as e:
        raise ApiError(
            500,
            "DATABASE_ERROR",
            "Failed to retrieve event from Supabase",
            {"details": str(e)},
        )


def add_waitlist_entry(event_id: str, payload: WaitlistCreate) -> WaitlistEntry:
    try:
        event = get_event(event_id)

        pos_res = (
            supabase.table("party")
            .select("uuid", count="exact")
            .eq("event_uuid", event_id)
            .in_("status", ["QUEUED", "NOTIFIED"])
            .execute()
        )

        current_queue_count = pos_res.count or 0
        new_position = current_queue_count + 1

        est_wait = max(5, new_position * 8)

        party_data = {
            "event_uuid": event_id,
            "account_uuid": event.account_uuid,
            "name": payload.name,
            "party_size": payload.party_size,
            "type": payload.type.value
            if hasattr(payload.type, "value")
            else str(payload.type),
            "status": "QUEUED",
            "position": new_position,
            "estimated_wait": est_wait,
        }

        response = supabase.table("party").insert(party_data).execute()

        if not response.data:
            raise ApiError(500, "DATABASE_ERROR", "Failed to add guest to waitlist")

        new_party_data = response.data[0]
        party_uuid = new_party_data.get("uuid")

        queue_data = {
            "uuid": party_uuid,
            "account_uuid": event.account_uuid,
            "event_uuid": event_id,
            "est_wait": est_wait,
            "queue_capacity": event.queue_capacity or 100,
            "interaction_count": 0,
            "last_active_time": now_utc().isoformat(),
            "high_risk": False,
        }

        supabase.table("table_queue").insert(queue_data).execute()

        return WaitlistEntry.model_validate(new_party_data)

    except Exception as e:
        raise ApiError(500, "DATABASE_ERROR", f"Waitlist Entry Failed: {str(e)}")