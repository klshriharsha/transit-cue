-- The UI lets a user track several origin/destination pairs (up to 5) from one subscription,
-- but the schema only ever allowed one commute_configs row per subscription. Lift that 1:1
-- constraint and enforce the 5-per-subscription cap in the database, so it holds regardless of
-- which code path inserts a row.

alter table commute_configs drop constraint commute_configs_subscription_id_key;

create index if not exists commute_configs_subscription_id_idx on commute_configs (subscription_id);

create or replace function enforce_commute_config_limit()
returns trigger as $$
begin
  if (select count(*) from commute_configs where subscription_id = new.subscription_id) >= 5 then
    raise exception 'A subscription cannot have more than 5 commute configs' using errcode = '23514';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists commute_configs_enforce_limit on commute_configs;

create trigger commute_configs_enforce_limit
  before insert on commute_configs
  for each row
  execute function enforce_commute_config_limit();
