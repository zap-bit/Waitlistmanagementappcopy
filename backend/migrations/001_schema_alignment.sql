-- Safe, idempotent alignment to schema.sql for Supabase/Postgres
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('USER', 'BUSINESS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    CREATE TYPE event_type AS ENUM ('TABLE', 'CAPACITY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cap_type') THEN
    CREATE TYPE cap_type AS ENUM ('SINGLE', 'MULTI', 'ATTENDANCE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exit_reason') THEN
    CREATE TYPE exit_reason AS ENUM ('SERVED', 'CANCEL', 'NO_SHOW');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ACCOUNT" (
  "UUID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('USER', 'BUSINESS')),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  business_name TEXT,
  phone TEXT,
  CHECK ((account_type = 'USER' AND business_name IS NULL) OR (account_type = 'BUSINESS' AND business_name IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS "EVENTS" (
  "UUID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_uuid UUID NOT NULL REFERENCES "ACCOUNT"("UUID"),
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
  avg_service_time INTEGER
);

CREATE TABLE IF NOT EXISTS "PARTY" (
  "UUID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_uuid UUID NOT NULL REFERENCES "ACCOUNT"("UUID"),
  event_uuid UUID NOT NULL REFERENCES "EVENTS"("UUID"),
  party_size INTEGER NOT NULL,
  special_req TEXT
);

CREATE TABLE IF NOT EXISTS "EVENT_TABLE" (
  "UUID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_uuid UUID REFERENCES "ACCOUNT"("UUID"),
  event_uuid UUID NOT NULL REFERENCES "EVENTS"("UUID"),
  table_capacity INTEGER NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "CAP_WAITLIST" (
  "UUID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_uuid UUID NOT NULL REFERENCES "ACCOUNT"("UUID"),
  event_uuid UUID NOT NULL REFERENCES "EVENTS"("UUID"),
  dropped_out BOOLEAN NOT NULL,
  no_show BOOLEAN NOT NULL,
  exit_reason TEXT CHECK (exit_reason IN ('SERVED', 'CANCEL', 'NO_SHOW'))
);

CREATE TABLE IF NOT EXISTS "TABLE_QUEUE" (
  "UUID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_uuid UUID NOT NULL REFERENCES "ACCOUNT"("UUID"),
  event_uuid UUID NOT NULL REFERENCES "EVENTS"("UUID"),
  est_wait INTEGER NOT NULL,
  queue_capacity INTEGER NOT NULL,
  interaction_count INTEGER,
  last_active_time TIMESTAMPTZ,
  high_risk BOOLEAN
);

CREATE TABLE IF NOT EXISTS "ATTENDANCE" (
  party_leader BOOLEAN NOT NULL,
  account_uuid UUID NOT NULL REFERENCES "ACCOUNT"("UUID"),
  event_uuid UUID NOT NULL REFERENCES "EVENTS"("UUID"),
  name TEXT NOT NULL,
  present BOOLEAN NOT NULL,
  PRIMARY KEY (account_uuid, event_uuid, name)
);

CREATE TABLE IF NOT EXISTS "NOTIFICATIONS" (
  "UUID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_uuid UUID NOT NULL REFERENCES "ACCOUNT"("UUID"),
  event_uuid UUID NOT NULL REFERENCES "EVENTS"("UUID"),
  sent_time TIMESTAMPTZ NOT NULL
);

ALTER TABLE "ACCOUNT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EVENTS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PARTY" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EVENT_TABLE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CAP_WAITLIST" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TABLE_QUEUE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ATTENDANCE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NOTIFICATIONS" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_account' AND tablename = 'ACCOUNT') THEN
    CREATE POLICY service_role_all_account ON "ACCOUNT" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_events' AND tablename = 'EVENTS') THEN
    CREATE POLICY service_role_all_events ON "EVENTS" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_party' AND tablename = 'PARTY') THEN
    CREATE POLICY service_role_all_party ON "PARTY" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_event_table' AND tablename = 'EVENT_TABLE') THEN
    CREATE POLICY service_role_all_event_table ON "EVENT_TABLE" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_cap_waitlist' AND tablename = 'CAP_WAITLIST') THEN
    CREATE POLICY service_role_all_cap_waitlist ON "CAP_WAITLIST" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_table_queue' AND tablename = 'TABLE_QUEUE') THEN
    CREATE POLICY service_role_all_table_queue ON "TABLE_QUEUE" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_attendance' AND tablename = 'ATTENDANCE') THEN
    CREATE POLICY service_role_all_attendance ON "ATTENDANCE" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_notifications' AND tablename = 'NOTIFICATIONS') THEN
    CREATE POLICY service_role_all_notifications ON "NOTIFICATIONS" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
