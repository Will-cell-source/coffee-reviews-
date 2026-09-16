-- Run this in the Supabase SQL editor. Nothing to edit — no staff list to keep.

create extension if not exists "pgcrypto";

create table reviews (
  id          uuid primary key default gen_random_uuid(),
  station     text not null,
  device_id   text not null,   -- random, generated on the phone. Not a person's name.
  raw_text    text not null,
  coffee_name text,
  created_at  timestamptz not null default now()
);

create index reviews_created_idx on reviews (created_at desc);
create index reviews_coffee_idx  on reviews (coffee_name);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  month       date not null,
  subject     text not null,
  body        text not null,
  note_count  integer not null,
  created_at  timestamptz not null default now()
);

-- Nothing talks to Supabase from the browser. All access is server-side
-- with the service role key, so lock the tables down completely.
alter table reviews enable row level security;
alter table reports enable row level security;
