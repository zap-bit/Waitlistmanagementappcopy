from datetime import datetime, timedelta, timezone
from app.services import calculate_heuristic_wait, get_user_weight, get_real_time_no_show_rate
from app.models import WaitlistEntry, EntryStatus, Event, EventType, EntryType
from app.store import store
import math

import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def setup_test_event(event_id, historical_rate=0.20, service_time=10):
    """Sets up a fake event with a specific historical no-show rate."""
    store.events[event_id] = Event(
        id=event_id,
        name="Heuristic Stress Test Cafe",
        eventType=EventType.OUTDOOR,
        maxCapacity=100,
        startTime=datetime.now(timezone.utc) - timedelta(hours=1), 
        endTime=datetime.now(timezone.utc) + timedelta(hours=2),
        avg_service_time=service_time,
        historical_no_show_rate=historical_rate
    )
    store.waitlists[event_id] = []

def print_queue_stats(event_id):
    entries = store.waitlists.get(event_id, [])
    queue = [e for e in entries if e.status == EntryStatus.QUEUED]
    print(f"{'Name':<12} | {'Est. Wait':<10} | {'Stale (m)':<10} | {'Weight':<8}")
    print("-" * 50)
    for e in queue:
        stale = (datetime.now(timezone.utc) - e.lastActiveTime).total_seconds() / 60
        weight = get_user_weight(e)
        print(f"{e.name:<12} | {e.estimatedWait:<10} | {stale:<10.1f} | {weight:<8.2f}")

def run_stress_test():
    event_id = "stress-test-999"
    setup_test_event(event_id, historical_rate=0.15, service_time=10)
    now = datetime.now(timezone.utc)

    print("\n--- SCENARIO 1: Mixed Queue Behavior ---")
    # User 1: Brand New (Weight 1.0)
    e1 = WaitlistEntry(eventId=event_id, name="Newbie", partySize=2, type=EntryType.waitlist, position=1, estimatedWait=30)
    e1.lastActiveTime = now

    # User 2: Patient Long-Wait (Weight 1.0)
    # They haven't checked in 45 mins, but their wait was 180 mins.
    # Logic: 180 * 0.5 = 90min grace period. They are safe.
    e2 = WaitlistEntry(eventId=event_id, name="PatientGuy", partySize=2, type=EntryType.waitlist, position=2, estimatedWait=180)
    e2.lastActiveTime = now - timedelta(minutes=45)

    # User 3: The Ghost (Weight ~0.1)
    # Short wait (20m), but hasn't pinged in 50m. Grace period was 20m.
    e3 = WaitlistEntry(eventId=event_id, name="GhostUser", partySize=4, type=EntryType.waitlist, position=3, estimatedWait=20)
    e3.lastActiveTime = now - timedelta(minutes=50)

    # User 4: The Power User (Weight 1.1)
    # Has pinged 10 times. Gets the 'Loyalty' boost.
    e4 = WaitlistEntry(eventId=event_id, name="LoyalUser", partySize=2, type=EntryType.waitlist, position=4, estimatedWait=15)
    e4.lastActiveTime = now
    e4.interactionCount = 10

    store.waitlists[event_id] = [e1, e2, e3, e4]
    
    print_queue_stats(event_id)
    wait = calculate_heuristic_wait(event_id)
    print(f"\nCalculated Wait for next person: {wait} mins")
    # Note: GhostUser (0.1) is barely counted, while LoyalUser (1.1) is counted extra.


    print("\n--- SCENARIO 2: Sudden Staff Speed-Up ---")
    # We simulate seating 2 people very quickly
    for i in range(2):
        e = WaitlistEntry(eventId=event_id, name=f"Seated {i}", partySize=2, type=EntryType.waitlist, position=0, estimatedWait=0)
        e.status = EntryStatus.SEATED
        store.waitlists[event_id].append(e)
    
    # We manually update service time (usually done in seat_user)
    # 60 mins elapsed / 2 people seated = 30 mins per person (Slow)
    # Let's say we seated 10 people in 60 mins = 6 mins per person (Fast)
    store.events[event_id].avg_service_time = 6 
    
    new_wait = calculate_heuristic_wait(event_id)
    print(f"Staff is moving fast (6m/person). New Wait: {new_wait} mins")


    print("\n--- SCENARIO 3: The 'Raining Outside' (High No-Shows) ---")
    # Add 10 people who finished, but 7 were No-Shows
    for i in range(10):
        status = EntryStatus.NO_SHOW if i < 7 else EntryStatus.SEATED
        e = WaitlistEntry(eventId=event_id, name=f"Old {i}", partySize=2, type=EntryType.waitlist, position=0, estimatedWait=0)
        e.status = status
        store.waitlists[event_id].append(e)

    real_no_show = get_real_time_no_show_rate(event_id)
    final_wait = calculate_heuristic_wait(event_id)
    
    print(f"Real-Time No-Show Rate: {real_no_show*100:.1f}%")
    print(f"Final Adjusted Wait: {final_wait} mins")

if __name__ == "__main__":
    run_stress_test()