begin;

-- Existing rows remain readable only after an authorized rebuild populates the payload.
-- Do not manufacture snapshots from independently updated global marks.
alter table quantos.portfolio_accounts
  add column snapshot_json jsonb,
  add column risk_input_json jsonb,
  add constraint portfolio_accounts_tenant_account_fk
    foreign key (tenant_id, account_id) references quantos.accounts(tenant_id, id) on delete cascade,
  add constraint portfolio_snapshot_binding check (snapshot_json is null or ((
    jsonb_typeof(snapshot_json) = 'object'
    and (snapshot_json->>'tenant_id')::uuid = tenant_id
    and (snapshot_json->>'account_id')::uuid = account_id
    and (snapshot_json->>'last_event_sequence')::bigint = last_event_sequence
    and (snapshot_json->>'as_of')::timestamptz = as_of
    and (snapshot_json->>'realized_pnl')::float8 = realized_pnl
    and (snapshot_json->>'unrealized_pnl')::float8 = unrealized_pnl
    and (snapshot_json->>'exposure_gross')::float8 = exposure_gross
    and (snapshot_json->>'exposure_net')::float8 = exposure_net
    and jsonb_typeof(snapshot_json->'positions') = 'array'
    and snapshot_json->>'snapshot_hash' ~ '^sha256:[0-9a-f]{64}$'
  ) is true)),
  add constraint portfolio_risk_binding check (risk_input_json is null or ((
    snapshot_json is not null
    and risk_input_json->>'schema_version' = 'quantos-risk-input/v1'
    and risk_input_json->'portfolio' = snapshot_json
    and risk_input_json->>'account_status' = 'active'
    and (risk_input_json->>'max_age_seconds')::integer between 1 and 3600
    and risk_input_json->>'input_hash' ~ '^sha256:[0-9a-f]{64}$'
  ) is true));

alter table quantos.portfolio_positions add constraint portfolio_positions_tenant_account_fk
  foreign key (tenant_id, account_id) references quantos.accounts(tenant_id, id) on delete cascade;

create function quantos.guard_portfolio_snapshot_head() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.last_event_sequence < old.last_event_sequence or new.as_of < old.as_of
    or (new.last_event_sequence = old.last_event_sequence and old.snapshot_json is not null
        and new.snapshot_json is distinct from old.snapshot_json)
    or (old.risk_input_json is not null and new.risk_input_json is not null
        and (new.risk_input_json->>'generated_at')::timestamptz < (old.risk_input_json->>'generated_at')::timestamptz)
  then raise exception 'PORTFOLIO_SNAPSHOT_CONFLICT' using errcode = '23514'; end if;
  return new;
end $$;
create trigger portfolio_snapshot_monotonic before update on quantos.portfolio_accounts
  for each row execute function quantos.guard_portfolio_snapshot_head();

-- Retain forced RLS/member SELECT policies; members have no projection write authority.
alter table quantos.portfolio_accounts enable row level security;
alter table quantos.portfolio_accounts force row level security;
alter table quantos.portfolio_positions enable row level security;
alter table quantos.portfolio_positions force row level security;
alter table quantos.portfolio_marks enable row level security;
alter table quantos.portfolio_marks force row level security;
revoke insert, update, delete on quantos.portfolio_accounts, quantos.portfolio_positions, quantos.portfolio_marks from anon, authenticated;
grant select on quantos.portfolio_accounts, quantos.portfolio_positions, quantos.portfolio_marks to authenticated;
grant select, insert, update, delete on quantos.portfolio_accounts, quantos.portfolio_positions, quantos.portfolio_marks to service_role;
comment on column quantos.portfolio_accounts.snapshot_json is 'Atomic account valuation at the saved ledger head; NULL legacy rows require rebuild.';
comment on column quantos.portfolio_accounts.risk_input_json is 'Tenant/account-bound input with source times, active account status and digest; consumer rechecks clock and age policy.';
commit;
