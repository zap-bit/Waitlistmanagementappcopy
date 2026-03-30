from __future__ import annotations

from dataclasses import dataclass, field

from app.models import Event, WaitlistEntry


@dataclass
class InMemoryStore:
    events: dict[str, Event] = field(default_factory=dict)
    waitlists: dict[str, list[WaitlistEntry]] = field(default_factory=dict)


store = InMemoryStore()
