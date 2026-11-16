-- Alerts used to fire a single push at a fixed `push_time`. Real commutes drift by several
-- minutes from day to day, so a one-off snapshot of departures goes stale before the rider is
-- out the door. An alert now covers a short *window* (up to 15 minutes): the first push lands
-- when the window opens, the same notification is replaced whenever the departure board
-- changes, and one last push marks it as no longer live once the window closes.

-- 1. Window columns. `window_start` is minutes after midnight in config.TIMEZONE (an integer
--    rather than "HH:MM" text so the "is this window open right now" check is plain arithmetic).
alter table commute_configs
  add column window_start smallint,
  add column window_minutes smallint not null default 10;

update commute_configs
set window_start = split_part(push_time, ':', 1)::smallint * 60 + split_part(push_time, ':', 2)::smallint;

alter table commute_configs
  alter column window_start set not null,
  add constraint commute_configs_window_start_range check (window_start between 0 and 1439),
  add constraint commute_configs_window_minutes_range check (window_minutes between 1 and 15);

comment on column commute_configs.window_start is
  'Minutes after midnight (config.TIMEZONE) at which the live window opens.';
comment on column commute_configs.window_minutes is
  'How long the live window stays open, in minutes (1-15). Existing alerts were migrated with 10.';

drop function if exists due_commute_configs(text, smallint);
drop index if exists commute_configs_push_time_idx;
alter table commute_configs drop column push_time;

-- 2. Per-day state for each window. The cron only pushes when the departure board actually
--    changes, so it has to remember what it last sent; it also needs to know whether the rider
--    dismissed the notification ("stop for today") and whether the closing push already went out.
create table commute_window_runs (
  commute_config_id uuid not null references commute_configs (id) on delete cascade,
  -- The calendar date (config.TIMEZONE) on which this window opened. A window that crosses
  -- midnight keeps the date it opened on.
  window_date date not null,
  -- Departure lines most recently pushed, without the "live until" footer. Compared verbatim
  -- against the freshly fetched board to decide whether to push again, and reused as the body of
  -- the closing push.
  last_body text,
  last_sent_at timestamptz,
  stopped boolean not null default false,
  finalized boolean not null default false,
  primary key (commute_config_id, window_date)
);

alter table commute_window_runs enable row level security;

-- 3. Everything the cron has to act on this minute, one row per alert:
--    phase 'live'  — the window is open.
--    phase 'ended' — the window closed within the last 5 minutes and a live notification was
--                    shown but not yet marked stale. The 5-minute grace means one missed cron
--                    tick doesn't leave a "live" notification on screen for good.
--    Paused alerts, days not in `repeat_days` and runs the rider stopped are filtered out here.
--    `p_now_minute`, `p_day` (0 = Sunday) and `p_today` are all in config.TIMEZONE, computed by
--    the caller. A window that started yesterday and runs past midnight is matched against
--    yesterday's day-of-week and date.
create function due_commute_windows(p_now_minute int, p_day int, p_today date)
returns table (
  id uuid,
  origin_id text,
  origin_name text,
  destination_id text,
  destination_name text,
  window_start smallint,
  window_minutes smallint,
  repeat_days smallint,
  paused boolean,
  phase text,
  window_date date,
  last_body text,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text
)
language sql
stable
as $$
  with timed as (
    select
      cc.*,
      (((p_now_minute - cc.window_start) % 1440) + 1440) % 1440 as elapsed,
      p_now_minute < cc.window_start as started_yesterday
    from commute_configs cc
    where not cc.paused
  ),
  dated as (
    select
      t.*,
      case when t.started_yesterday then (p_day + 6) % 7 else p_day end as window_day,
      case when t.started_yesterday then p_today - 1 else p_today end as run_date
    from timed t
  )
  select
    d.id, d.origin_id, d.origin_name, d.destination_id, d.destination_name,
    d.window_start, d.window_minutes, d.repeat_days, d.paused,
    case when d.elapsed < d.window_minutes then 'live' else 'ended' end as phase,
    d.run_date as window_date,
    r.last_body,
    s.id as subscription_id, s.endpoint, s.p256dh, s.auth
  from dated d
  join subscriptions s on s.id = d.subscription_id
  left join commute_window_runs r on r.commute_config_id = d.id and r.window_date = d.run_date
  where (d.repeat_days & (1 << d.window_day)) <> 0
    and not coalesce(r.stopped, false)
    and (
      d.elapsed < d.window_minutes
      or (d.elapsed < d.window_minutes + 5 and r.last_body is not null and not r.finalized)
    );
$$;

-- Like the rest of this schema, RLS with no policies (not a grant) keeps the anon/authenticated
-- keys from reading through this SECURITY INVOKER function.
