-- Define Enums
CREATE TYPE account_type AS ENUM ('USER', 'BUSINESS');
CREATE TYPE event_type AS ENUM ('TABLE', 'CAPACITY');
CREATE TYPE cap_type AS ENUM ('SINGLE', 'MULTI', 'ATTENDANCE');
CREATE TYPE exit_reason AS ENUM ('SERVED', 'CANCEL', 'NO_SHOW');

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: ACCOUNT
CREATE TABLE ACCOUNT (
    UUID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('USER', 'BUSINESS')),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    business_name TEXT,
    phone TEXT,
    CHECK (
        (account_type = 'USER' AND business_name IS NULL) OR
        (account_type = 'BUSINESS' AND business_name IS NOT NULL)
    )
);

-- Table: EVENTS
CREATE TABLE EVENTS (
    UUID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid UUID NOT NULL REFERENCES ACCOUNT(UUID),
    name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('TABLE', 'CAPACITY')),
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    location TEXT,
    cap_type TEXT CHECK (cap_type IN ('SINGLE', 'MULTI', 'ATTENDANCE')),
    queue_capacity INTEGER,
    est_wait INTEGER,
    num_tables INTEGER,
    avg_size INTEGER,
    reservation_duration INTEGER,
    no_show_policy INTEGER,
    no_show_rate INTEGER,
    avg_service_time INTEGER,
    CONSTRAINT event_type_constraints CHECK (
        (event_type = 'CAPACITY' AND cap_type IS NOT NULL AND queue_capacity IS NOT NULL AND est_wait IS NOT NULL AND num_tables IS NULL AND avg_size IS NULL AND reservation_duration IS NULL AND no_show_policy IS NULL AND no_show_rate IS NULL AND avg_service_time IS NULL) OR
        (event_type = 'TABLE' AND num_tables IS NOT NULL AND avg_size IS NOT NULL AND reservation_duration IS NOT NULL AND no_show_policy IS NOT NULL AND cap_type IS NULL AND queue_capacity IS NULL AND est_wait IS NULL AND no_show_rate IS NULL AND avg_service_time IS NULL)
    )
);

-- Table: PARTY
CREATE TABLE PARTY (
    UUID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid UUID NOT NULL REFERENCES ACCOUNT(UUID),
    event_uuid UUID NOT NULL REFERENCES EVENTS(UUID),
    party_size INTEGER NOT NULL,
    special_req TEXT
);

-- Table: EVENT_TABLE
CREATE TABLE EVENT_TABLE (
    UUID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid UUID REFERENCES ACCOUNT(UUID),
    event_uuid UUID NOT NULL REFERENCES EVENTS(UUID),
    table_capacity INTEGER NOT NULL,
    name TEXT NOT NULL
);

-- Table: CAP_WAITLIST
CREATE TABLE CAP_WAITLIST (
    UUID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid UUID NOT NULL REFERENCES ACCOUNT(UUID),
    event_uuid UUID NOT NULL REFERENCES EVENTS(UUID),
    dropped_out BOOLEAN NOT NULL,
    no_show BOOLEAN NOT NULL,
    exit_reason TEXT CHECK (exit_reason IN ('SERVED', 'CANCEL', 'NO_SHOW'))
);

-- Table: TABLE_QUEUE
CREATE TABLE TABLE_QUEUE (
    UUID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid UUID NOT NULL REFERENCES ACCOUNT(UUID),
    event_uuid UUID NOT NULL REFERENCES EVENTS(UUID),
    est_wait INTEGER NOT NULL,
    queue_capacity INTEGER NOT NULL,
    interaction_count INTEGER,
    last_active_time TIMESTAMP WITH TIME ZONE,
    high_risk BOOLEAN
);

-- Table: ATTENDANCE
CREATE TABLE ATTENDANCE (
    party_leader BOOLEAN NOT NULL,
    account_uuid UUID NOT NULL REFERENCES ACCOUNT(UUID),
    event_uuid UUID NOT NULL REFERENCES EVENTS(UUID),
    name TEXT NOT NULL,
    present BOOLEAN NOT NULL,
    PRIMARY KEY (account_uuid, event_uuid, name)
);

-- Table: NOTIFICATIONS
CREATE TABLE NOTIFICATIONS (
    UUID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid UUID NOT NULL REFERENCES ACCOUNT(UUID),
    event_uuid UUID NOT NULL REFERENCES EVENTS(UUID),
    sent_time TIMESTAMP WITH TIME ZONE NOT NULL
);