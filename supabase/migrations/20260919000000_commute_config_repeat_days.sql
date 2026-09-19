-- The UI already lets a user pick which days of the week a commute alert repeats on, but the
-- backend has always notified every day regardless of that selection. Store the selection as a
-- single bitmask column (bit i set == day i, where day-of-week follows JS `Date.getDay()` /
-- Postgres `extract(dow from ...)`: 0 = Sunday .. 6 = Saturday) rather than a join table or a
-- text array of weekday names, so one alert stays one row, membership is a single integer
-- comparison, and the encoding lines up with both ends without a lookup table.

alter table commute_configs
  add column repeat_days smallint not null default 62; -- 62 = bits 1..5 set = Mon-Fri, the UI's current default

alter table commute_configs
  add constraint commute_configs_repeat_days_range check (repeat_days between 1 and 127);

comment on column commute_configs.repeat_days is
  'Bitmask of days this alert repeats on: bit 0 = Sunday .. bit 6 = Saturday (1 << day-of-week). Always has at least one bit set.';

-- Finds the commute configs due right now: matching push_time whose repeat_days bitmask
-- includes today's day-of-week bit. Expressed as a function (rather than a bitwise filter from
-- the application) because PostgREST's REST filter operators don't include a bitwise AND.
create or replace function due_commute_configs(p_push_time text, p_day_bit smallint)
returns table (
  id uuid,
  origin_id text,
  origin_name text,
  destination_id text,
  destination_name text,
  push_time text,
  repeat_days smallint,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text
)
language sql
stable
as $$
  select
    cc.id, cc.origin_id, cc.origin_name, cc.destination_id, cc.destination_name, cc.push_time, cc.repeat_days,
    s.id as subscription_id, s.endpoint, s.p256dh, s.auth
  from commute_configs cc
  join subscriptions s on s.id = cc.subscription_id
  where cc.push_time = p_push_time
    and (cc.repeat_days & p_day_bit) <> 0;
$$;

-- This function runs as SECURITY INVOKER (the default), so it's still subject to RLS on
-- commute_configs/subscriptions: like every other query in this schema, it's the RLS-enabled,
-- no-policies setup from the init migration — not a function-level grant — that keeps the
-- anon/authenticated keys from reading through it, even though PostgREST exposes it to them.
