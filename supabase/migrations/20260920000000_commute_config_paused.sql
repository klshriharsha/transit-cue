-- Lets a user pause a commute alert without deleting it (e.g. while on holiday), then resume it
-- later with the same schedule intact.

alter table commute_configs
  add column paused boolean not null default false;

comment on column commute_configs.paused is
  'When true, this alert is excluded from due_commute_configs and receives no pushes until unpaused.';

-- Re-create due_commute_configs to also exclude paused alerts, so they're skipped at the DB level
-- and never reach the reminder sender at all. Dropped first because the return columns are
-- changing (adding `paused`), which `create or replace` can't do to an existing function.
drop function due_commute_configs(text, smallint);

create function due_commute_configs(p_push_time text, p_day_bit smallint)
returns table (
  id uuid,
  origin_id text,
  origin_name text,
  destination_id text,
  destination_name text,
  push_time text,
  repeat_days smallint,
  paused boolean,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text
)
language sql
stable
as $$
  select
    cc.id, cc.origin_id, cc.origin_name, cc.destination_id, cc.destination_name, cc.push_time, cc.repeat_days, cc.paused,
    s.id as subscription_id, s.endpoint, s.p256dh, s.auth
  from commute_configs cc
  join subscriptions s on s.id = cc.subscription_id
  where cc.push_time = p_push_time
    and (cc.repeat_days & p_day_bit) <> 0
    and not cc.paused;
$$;
