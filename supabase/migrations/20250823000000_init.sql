create extension if not exists "pgcrypto";

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists commute_configs (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null unique references subscriptions (id) on delete cascade,
  origin_id text not null,
  origin_name text not null,
  destination_id text not null,
  destination_name text not null,
  push_time text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commute_configs_push_time_idx on commute_configs (push_time);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists commute_configs_set_updated_at on commute_configs;

create trigger commute_configs_set_updated_at
  before update on commute_configs
  for each row
  execute function set_updated_at();

-- Only the Vercel functions talk to this database, using the service role key, which bypasses
-- RLS entirely. RLS is enabled anyway with no policies so the anon/authenticated keys (if ever
-- exposed) get zero access by default rather than an oversight-prone allow-all.
alter table subscriptions enable row level security;
alter table commute_configs enable row level security;
