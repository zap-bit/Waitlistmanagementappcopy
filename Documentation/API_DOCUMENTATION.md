# Waitlist Management API - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Event Types](#event-types)
3. [Core Concepts](#core-concepts)
4. [Authentication](#authentication)
5. [Common Workflows](#common-workflows)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [Code Examples](#code-examples)

---

## Overview

The Waitlist Management API provides a comprehensive solution for managing event waitlists across three distinct event types. The API is designed with offline-first principles and includes AI-powered wait time predictions.

### Base URLs
- **Production**: `https://api.waitlist-app.com/v1`
- **Staging**: `https://staging-api.waitlist-app.com/v1`
- **Development**: `http://localhost:8000/v1`

### Key Features
- Three event types (OUTDOOR, INDOOR_TABLES, INDOOR_SEATED)
- Dual-queue system (reservations + waitlist)
- Smart table/seat assignment with special request handling
- Offline-first architecture with sync capabilities
- AI-driven wait time predictions
- Real-time staff dashboard
- QR code check-in support

---

## Event Types

### 1. OUTDOOR Events
**Use Case**: Parks, festivals, outdoor concerts, open-air markets

**Characteristics**:
- General admission (no specific seating)
- Manual capacity tracking
- Simple occupancy management
- Weather-dependent

**Required Fields**:
- `maxCapacity`: Total venue capacity

**Example**:
```json
{
  "name": "Summer Music Festival 2026",
  "eventType": "OUTDOOR",
  "maxCapacity": 5000,
  "startTime": "2026-06-15T14:00:00Z",
  "endTime": "2026-06-15T23:00:00Z"
}
```

### 2. INDOOR_TABLES Events
**Use Case**: Restaurants, cafes, conference rooms with table seating

**Characteristics**:
- Table-based seating management
- Smart table assignment based on party size
- Special request handling (specific table, proximity to others)
- Grid-based layout visualization

**Required Fields**:
- `maxCapacity`: Total guest capacity
- `totalTables`: Number of tables (auto-generated with default capacity 4)

**Example**:
```json
{
  "name": "Fine Dining Restaurant",
  "eventType": "INDOOR_TABLES",
  "maxCapacity": 100,
  "totalTables": 12,
  "startTime": "2026-03-20T17:00:00Z",
  "endTime": "2026-03-20T23:00:00Z"
}
```

**Table Management**:
- Tables arranged in 4-column grid
- Each table has: ID, name, capacity, row, col, occupied status
- Tables can be renamed and capacity adjusted
- Smart assignment algorithm considers: party size, special requests, availability

### 3. INDOOR_SEATED Events
**Use Case**: Theaters, concert halls, stadiums with assigned seating

**Characteristics**:
- Individual seat assignment
- Section/row/number organization
- Seat reservation system
- Capacity = total seats

**Required Fields**:
- `maxCapacity`: Total number of seats
- `totalSeats`: Same as maxCapacity (for clarity)

**Example**:
```json
{
  "name": "Broadway Musical",
  "eventType": "INDOOR_SEATED",
  "maxCapacity": 800,
  "totalSeats": 800,
  "startTime": "2026-04-10T19:30:00Z",
  "endTime": "2026-04-10T22:00:00Z"
}
```

---

## Core Concepts

### Waitlist Entry Types

#### Reservation
- Pre-confirmed booking
- Priority over standard waitlist
- Typically created in advance
- Example use: Restaurant reservations, theater bookings

#### Waitlist
- Walk-in/same-day entry
- FIFO queue (with AI optimization)
- Real-time wait time estimates
- Example use: Restaurant walk-ins, festival entry

### Entry Status Flow

```
QUEUED → NOTIFIED → SEATED
   ↓         ↓         ↓
CANCELLED  EXPIRED  NO_SHOW
```

- **QUEUED**: In line, waiting
- **NOTIFIED**: Called/ready to be seated
- **SEATED**: Successfully seated
- **NO_SHOW**: Failed to appear when called
- **CANCELLED**: Manually cancelled
- **EXPIRED**: Notification expired without response

### Special Requests Parsing

The API intelligently parses special requests:

| Request Format | Interpretation | Example |
|---|---|---|
| `"Table 5"` or `"#5"` | Specific table request | Assigns Table 5 if available |
| `"Near Sarah Johnson"` | Proximity request | Seats near specified guest's table |
| `"Window table"` | General preference | Notes preference (manual staff decision) |

---

## Authentication

### JWT Bearer Token

All API requests require authentication via JWT bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

### API Key (Service-to-Service)

For backend integrations:

```http
X-API-Key: <your-api-key>
```

### Getting a Token

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "role": "staff"
}
```

---

## Common Workflows

### Workflow 1: Creating an Event

**Step 1**: Determine event type
```javascript
// For a restaurant
const eventType = "INDOOR_TABLES";
const totalTables = 12;

// For a theater
const eventType = "INDOOR_SEATED";
const totalSeats = 500;

// For a festival
const eventType = "OUTDOOR";
const maxCapacity = 5000;
```

**Step 2**: Create the event
```bash
POST /events
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Fine Dining Restaurant",
  "eventType": "INDOOR_TABLES",
  "startTime": "2026-03-20T17:00:00Z",
  "endTime": "2026-03-20T23:00:00Z",
  "maxCapacity": 100,
  "totalTables": 12,
  "offlineEnabled": true
}
```

**Step 3**: Event is created with auto-generated tables/seats

### Workflow 2: Guest Joins Waitlist

**Attendee App Flow**:

1. **Scan QR Code** or manually enter event code
```bash
GET /events/{eventId}
```

2. **Join Waitlist**
```bash
POST /events/{eventId}/waitlist
Content-Type: application/json

{
  "name": "Sarah Johnson",
  "partySize": 4,
  "type": "waitlist",
  "phoneNumber": "+14155552671",
  "specialRequests": "Table 5 or near window",
  "notificationPreferences": {
    "sms": true,
    "push": true
  }
}
```

3. **Receive Entry ID and Position**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Sarah Johnson",
  "partySize": 4,
  "type": "waitlist",
  "status": "QUEUED",
  "position": 3,
  "estimatedWait": 25,
  "joinedAt": "2026-03-20T18:15:00Z"
}
```

4. **Poll for Updates** (or use WebSocket)
```bash
GET /events/{eventId}/waitlist/{entryId}
```

### Workflow 3: Staff Seats Guest

**Staff Dashboard Flow**:

1. **Get Dashboard Overview**
```bash
GET /events/{eventId}/staff/dashboard
```

Response shows:
- Current occupancy
- Waitlist counts (by type)
- Table/seat availability
- Recent activity

2. **Auto-Promote Next Guest**
```bash
POST /events/{eventId}/staff/promote
Content-Type: application/json

{
  "count": 1,
  "type": "reservation"  // Optional: prioritize reservations
}
```

The API will:
- ✓ Find next in queue
- ✓ Check special requests
- ✓ Assign best available table/seat
- ✓ Send notification to guest
- ✓ Update occupancy

3. **Manual Override** (if needed)
```bash
POST /events/{eventId}/staff/seat
Content-Type: application/json

{
  "entryId": "880e8400-e29b-41d4-a716-446655440003",
  "tableId": 5,
  "reason": "Guest requested this table"
}
```

### Workflow 4: Offline Mode Sync

**Device goes offline**:
1. App continues operating with local data (localStorage/SQLite)
2. All changes queued in sync payload

**Device comes online**:
```bash
POST /sync
Content-Type: application/json

{
  "deviceId": "device-12345",
  "syncTimestamp": "2026-03-20T19:30:00Z",
  "operations": [
    {
      "type": "CREATE",
      "resource": "waitlist_entry",
      "resourceId": "temp-id-001",
      "data": {
        "name": "John Doe",
        "partySize": 2,
        "type": "waitlist"
      },
      "timestamp": "2026-03-20T19:15:00Z",
      "conflictResolution": "SERVER_WINS"
    },
    {
      "type": "UPDATE",
      "resource": "table",
      "resourceId": "3",
      "data": {
        "occupied": true,
        "guestName": "Jane Smith"
      },
      "timestamp": "2026-03-20T19:20:00Z"
    }
  ]
}
```

Server responds with conflicts and resolutions.

---

## Error Handling

### Standard Error Response

```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Event not found",
  "details": {
    "eventId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2026-03-20T18:30:00Z",
  "requestId": "req-12345"
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|---|---|---|
| 400 | `INVALID_INPUT` | Validation error (party size, dates, etc.) |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions (staff-only endpoint) |
| 404 | `RESOURCE_NOT_FOUND` | Event, entry, or table not found |
| 409 | `ALREADY_EXISTS` | Guest already on waitlist |
| 409 | `TABLE_OCCUPIED` | Attempting to use occupied table |
| 409 | `NO_CAPACITY` | Event at max capacity |
| 500 | `INTERNAL_ERROR` | Server error |

### Error Handling Best Practices

```javascript
async function joinWaitlist(eventId, guestData) {
  try {
    const response = await fetch(`/events/${eventId}/waitlist`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(guestData)
    });

    if (!response.ok) {
      const error = await response.json();
      
      switch (error.code) {
        case 'ALREADY_EXISTS':
          alert('You are already on the waitlist!');
          break;
        case 'NO_CAPACITY':
          alert('Event is at full capacity');
          break;
        case 'INVALID_INPUT':
          alert(`Invalid input: ${error.message}`);
          break;
        default:
          alert('An error occurred. Please try again.');
      }
      
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Network error:', error);
    alert('Connection error. Please check your internet.');
    return null;
  }
}
```

---

## Best Practices

### 1. Event Type Selection

Choose the right event type:
- **OUTDOOR**: When exact seating doesn't matter (festivals, parks)
- **INDOOR_TABLES**: When groups share tables (restaurants, conferences)
- **INDOOR_SEATED**: When individual seat assignment matters (theaters, stadiums)

### 2. Capacity Planning

For INDOOR_TABLES events:
```javascript
// Calculate capacity from tables
const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);

// Recommended: maxCapacity = totalCapacity (strict)
// or maxCapacity = totalCapacity * 1.1 (10% buffer for flexibility)
```

### 3. Special Requests

Standardize request formats for better parsing:
- "Table 5" or "#5"
- "Near Sarah Johnson"
- Inaccurate example: "I'd like to be somewhere near table five maybe"

### 4. Offline-First Implementation

```javascript
// Store data locally
localStorage.setItem('waitlist', JSON.stringify(waitlistData));

// Check online status
window.addEventListener('online', () => syncWithServer());
window.addEventListener('offline', () => enableOfflineMode());

// Sync when back online
async function syncWithServer() {
  const pendingOps = getPendingOperations();
  await fetch('/sync', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: getDeviceId(),
      operations: pendingOps
    })
  });
}
```

### 5. Polling vs WebSocket

For real-time updates:

**Polling** (simpler, works offline-first):
```javascript
setInterval(async () => {
  const entry = await fetchWaitlistEntry(entryId);
  updateUI(entry);
}, 15000); // Poll every 15 seconds
```

**WebSocket** (more efficient):
```javascript
const ws = new WebSocket('wss://api.waitlist-app.com/ws');
ws.send(JSON.stringify({
  action: 'subscribe',
  eventId: eventId,
  entryId: entryId
}));
```

### 6. Performance Optimization

**Pagination**:
```bash
GET /events/{eventId}/waitlist?page=1&pageSize=20
```

**Filtering**:
```bash
GET /events/{eventId}/waitlist?type=reservation&status=QUEUED
```

**Caching**:
```javascript
// Cache static event data
const event = await getCachedOrFetch(`events/${eventId}`, 300000); // 5min cache
```

---

## Code Examples

### Frontend Integration (React)

```typescript
// hooks/useWaitlist.ts
import { useState, useEffect } from 'react';

interface WaitlistEntry {
  id: string;
  name: string;
  partySize: number;
  position: number;
  estimatedWait: number;
  status: string;
}

export function useWaitlist(eventId: string, entryId: string) {
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntry = async () => {
      try {
        const response = await fetch(
          `/api/events/${eventId}/waitlist/${entryId}`,
          {
            headers: {
              'Authorization': `Bearer ${getToken()}`
            }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch entry');
        
        const data = await response.json();
        setEntry(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEntry();
    const interval = setInterval(fetchEntry, 15000); // Poll every 15s

    return () => clearInterval(interval);
  }, [eventId, entryId]);

  return { entry, loading, error };
}

// Component usage
function WaitlistStatus({ eventId, entryId }) {
  const { entry, loading, error } = useWaitlist(eventId, entryId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!entry) return <div>Not found</div>;

  return (
    <div>
      <h2>Position: #{entry.position}</h2>
      <p>Estimated wait: {entry.estimatedWait} minutes</p>
      <p>Status: {entry.status}</p>
    </div>
  );
}
```

### Backend Integration (Node.js/Express)

```javascript
// services/waitlist.service.js
const axios = require('axios');

class WaitlistService {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.API_BASE_URL,
      headers: {
        'X-API-Key': process.env.API_KEY
      }
    });
  }

  async createEvent(eventData) {
    try {
      const response = await this.client.post('/events', eventData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addToWaitlist(eventId, guestData) {
    try {
      const response = await this.client.post(
        `/events/${eventId}/waitlist`,
        guestData
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async promoteNextGuest(eventId, type = null) {
    try {
      const response = await this.client.post(
        `/events/${eventId}/staff/promote`,
        { count: 1, type }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      return new Error(error.response.data.message);
    }
    return error;
  }
}

module.exports = new WaitlistService();
```

### Python Integration (FastAPI)

```python
# services/waitlist_service.py
import httpx
from typing import Optional, Dict, List
from datetime import datetime

class WaitlistAPI:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={"X-API-Key": api_key}
        )
    
    async def create_event(
        self,
        name: str,
        event_type: str,
        start_time: datetime,
        end_time: datetime,
        max_capacity: int,
        **kwargs
    ) -> Dict:
        """Create a new event"""
        payload = {
            "name": name,
            "eventType": event_type,
            "startTime": start_time.isoformat(),
            "endTime": end_time.isoformat(),
            "maxCapacity": max_capacity,
            **kwargs
        }
        
        response = await self.client.post("/events", json=payload)
        response.raise_for_status()
        return response.json()
    
    async def join_waitlist(
        self,
        event_id: str,
        name: str,
        party_size: int,
        entry_type: str = "waitlist",
        special_requests: Optional[str] = None
    ) -> Dict:
        """Add guest to waitlist"""
        payload = {
            "name": name,
            "partySize": party_size,
            "type": entry_type,
            "specialRequests": special_requests
        }
        
        response = await self.client.post(
            f"/events/{event_id}/waitlist",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    async def get_dashboard(self, event_id: str) -> Dict:
        """Get staff dashboard data"""
        response = await self.client.get(
            f"/events/{event_id}/staff/dashboard"
        )
        response.raise_for_status()
        return response.json()

# Usage
api = WaitlistAPI(
    base_url="https://api.waitlist-app.com/v1",
    api_key="your-api-key"
)

event = await api.create_event(
    name="Summer Festival",
    event_type="OUTDOOR",
    start_time=datetime(2026, 6, 15, 14, 0),
    end_time=datetime(2026, 6, 15, 23, 0),
    max_capacity=5000
)
```

---

## Migration Guide (from current prototype)

### Current vs. API Contract

| Current Implementation | API Contract |
|---|---|
| `type: 'reservation' \| 'waitlist'` | `type: 'reservation' \| 'waitlist'` ✅ Same |
| Tables stored in localStorage | Tables managed via `/events/{eventId}/tables` |
| Manual capacity tracking | Automatic via table/seat occupancy |
| Local-only operation | API-backed with offline sync |

### Migration Steps

1. **Replace localStorage with API calls**
```javascript
// Before
const waitlist = JSON.parse(localStorage.getItem('waitlist'));

// After
const response = await fetch(`/events/${eventId}/waitlist`);
const { data: waitlist } = await response.json();
```

2. **Update table management**
```javascript
// Before
setTables(tables.map(t => t.id === tableId ? { ...t, occupied: true } : t));

// After
await fetch(`/events/${eventId}/tables/${tableId}/occupy`, {
  method: 'POST',
  body: JSON.stringify({ guestName, partySize })
});
```

3. **Implement sync for offline mode**
```javascript
// Queue operations when offline
if (!navigator.onLine) {
  queueOperation({
    type: 'CREATE',
    resource: 'waitlist_entry',
    data: entryData
  });
}

// Sync when back online
window.addEventListener('online', syncPendingOperations);
```

---

## Support & Resources

- **API Documentation**: https://docs.waitlist-app.com
- **OpenAPI Spec**: See `waitlist-api-v1.yaml`

---

**Version**: 1.0.0  
**Last Updated**: February 14, 2026  
**Team**: Team 12 - Waitlist Management
