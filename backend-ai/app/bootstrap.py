from __future__ import annotations

from datetime import datetime, timezone

from app.models import EntryType, Event, EventType, WaitlistEntry
from app.store import store

DOC_EVENT_ID = "550e8400-e29b-41d4-a716-446655440000"
DOC_ENTRY_ID = "880e8400-e29b-41d4-a716-446655440003"
LEGACY_EVENT_ID = "223"


def seed_demo_data() -> None:
    """Seed deterministic demo records so frontend boilerplates can run immediately.

    This avoids repeated 404s when a frontend starts polling with reference IDs
    from project docs before creating fresh test data.
    """

    if DOC_EVENT_ID not in store.events:
        store.events[DOC_EVENT_ID] = Event(
            id=DOC_EVENT_ID,
            name="Demo Festival Event",
            eventType=EventType.OUTDOOR,
            maxCapacity=5000,
            startTime=datetime(2026, 6, 15, 14, 0, tzinfo=timezone.utc),
            endTime=datetime(2026, 6, 15, 23, 0, tzinfo=timezone.utc),
            offlineEnabled=True,
        )

    if LEGACY_EVENT_ID not in store.events:
        store.events[LEGACY_EVENT_ID] = Event(
            id=LEGACY_EVENT_ID,
            name="Legacy Demo Venue",
            eventType=EventType.OUTDOOR,
            maxCapacity=500,
            startTime=datetime(2026, 3, 20, 17, 0, tzinfo=timezone.utc),
            endTime=datetime(2026, 3, 20, 23, 0, tzinfo=timezone.utc),
            offlineEnabled=True,
        )

    store.waitlists.setdefault(DOC_EVENT_ID, [])
    store.waitlists.setdefault(LEGACY_EVENT_ID, [])

    if not any(e.id == DOC_ENTRY_ID for e in store.waitlists[DOC_EVENT_ID]):
        store.waitlists[DOC_EVENT_ID].append(
            WaitlistEntry(
                id=DOC_ENTRY_ID,
                eventId=DOC_EVENT_ID,
                name="Sarah Johnson",
                partySize=4,
                type=EntryType.waitlist,
                position=3,
                estimatedWait=25,
            )
        )
