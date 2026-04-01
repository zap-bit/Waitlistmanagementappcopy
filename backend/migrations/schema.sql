-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.account (
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type = ANY (ARRAY['USER'::text, 'BUSINESS'::text])),
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  business_name text,
  phone text,
  CONSTRAINT account_pkey PRIMARY KEY (uuid)
);
CREATE TABLE public.attendance (
  party_leader boolean NOT NULL,
  account_uuid uuid NOT NULL,
  event_uuid uuid NOT NULL,
  name text NOT NULL,
  present boolean NOT NULL,
  CONSTRAINT attendance_pkey PRIMARY KEY (account_uuid, event_uuid, name),
  CONSTRAINT attendance_account_uuid_fkey FOREIGN KEY (account_uuid) REFERENCES public.account(uuid),
  CONSTRAINT attendance_event_uuid_fkey FOREIGN KEY (event_uuid) REFERENCES public.events(uuid)
);
CREATE TABLE public.cap_waitlist (
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  account_uuid uuid NOT NULL,
  event_uuid uuid NOT NULL,
  dropped_out boolean NOT NULL,
  no_show boolean NOT NULL,
  exit_reason text CHECK (exit_reason = ANY (ARRAY['SERVED'::text, 'CANCEL'::text, 'NO_SHOW'::text])),
  CONSTRAINT cap_waitlist_pkey PRIMARY KEY (uuid),
  CONSTRAINT cap_waitlist_account_uuid_fkey FOREIGN KEY (account_uuid) REFERENCES public.account(uuid),
  CONSTRAINT cap_waitlist_event_uuid_fkey FOREIGN KEY (event_uuid) REFERENCES public.events(uuid)
);
CREATE TABLE public.event_table (
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  account_uuid uuid,
  event_uuid uuid NOT NULL,
  table_capacity integer NOT NULL,
  name text NOT NULL,
  row_index integer NOT NULL DEFAULT 0,
  col_index integer NOT NULL DEFAULT 0,
  table_number integer NOT NULL DEFAULT 1,
  occupied boolean NOT NULL DEFAULT false,
  guest_name text,
  party_size integer,
  seated_at timestamp with time zone,
  CONSTRAINT event_table_pkey PRIMARY KEY (uuid),
  CONSTRAINT event_table_account_uuid_fkey FOREIGN KEY (account_uuid) REFERENCES public.account(uuid),
  CONSTRAINT event_table_event_uuid_fkey FOREIGN KEY (event_uuid) REFERENCES public.events(uuid)
);
CREATE TABLE public.events (
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  account_uuid uuid NOT NULL,
  name text NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['TABLE'::text, 'CAPACITY'::text])),
  archived boolean NOT NULL DEFAULT false,
  location text,
  cap_type text CHECK (cap_type = ANY (ARRAY['SINGLE'::text, 'MULTI'::text, 'ATTENDANCE'::text])),
  queue_capacity integer,
  est_wait integer,
  num_tables integer,
  avg_size integer,
  reservation_duration integer,
  no_show_policy integer,
  no_show_rate integer,
  avg_service_time integer,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  current_count integer,
  current_filled_tables integer,
  CONSTRAINT events_pkey PRIMARY KEY (uuid),
  CONSTRAINT events_account_uuid_fkey FOREIGN KEY (account_uuid) REFERENCES public.account(uuid)
);
CREATE TABLE public.notifications (
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  account_uuid uuid NOT NULL,
  event_uuid uuid NOT NULL,
  sent_time timestamp with time zone NOT NULL,
  CONSTRAINT notifications_pkey PRIMARY KEY (uuid),
  CONSTRAINT notifications_account_uuid_fkey FOREIGN KEY (account_uuid) REFERENCES public.account(uuid),
  CONSTRAINT notifications_event_uuid_fkey FOREIGN KEY (event_uuid) REFERENCES public.events(uuid)
);
CREATE TABLE public.party (
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  account_uuid uuid NOT NULL,
  event_uuid uuid NOT NULL,
  party_size integer NOT NULL,
  special_req text,
  name text,
  type text DEFAULT 'waitlist'::text CHECK (type = ANY (ARRAY['reservation'::text, 'waitlist'::text])),
  status text NOT NULL DEFAULT 'QUEUED'::text,
  position integer NOT NULL DEFAULT 1,
  estimated_wait integer NOT NULL DEFAULT 5,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT party_pkey PRIMARY KEY (uuid),
  CONSTRAINT party_account_uuid_fkey FOREIGN KEY (account_uuid) REFERENCES public.account(uuid),
  CONSTRAINT party_event_uuid_fkey FOREIGN KEY (event_uuid) REFERENCES public.events(uuid)
);
CREATE TABLE public.table_queue (
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  account_uuid uuid NOT NULL,
  event_uuid uuid NOT NULL,
  est_wait integer NOT NULL,
  queue_capacity integer NOT NULL,
  interaction_count integer,
  last_active_time timestamp with time zone,
  high_risk boolean,
  CONSTRAINT table_queue_pkey PRIMARY KEY (uuid),
  CONSTRAINT table_queue_account_uuid_fkey FOREIGN KEY (account_uuid) REFERENCES public.account(uuid),
  CONSTRAINT table_queue_event_uuid_fkey FOREIGN KEY (event_uuid) REFERENCES public.events(uuid)
);
