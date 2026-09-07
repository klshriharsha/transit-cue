-- A push endpoint is a rotating transport address, not a stable identity: the browser mints a
-- fresh endpoint (and keys) every time the user toggles notifications off and back on, and push
-- services also rotate it on their own. Keying `subscriptions` on `endpoint` therefore stranded
-- the row's `commute_configs` on every toggle. `client_id` is a UUID the browser generates once
-- and keeps in localStorage, so resubscribing updates the same row in place and the linked
-- commute config survives.

alter table subscriptions add column if not exists client_id text;

-- Existing rows predate the client id. Give each a random one so the NOT NULL / UNIQUE
-- constraints hold; these values match no browser, so those rows just get pruned on the next
-- 404/410 from their (already stale) endpoint.
update subscriptions set client_id = gen_random_uuid()::text where client_id is null;

alter table subscriptions alter column client_id set not null;

alter table subscriptions
  add constraint subscriptions_client_id_key unique (client_id);
