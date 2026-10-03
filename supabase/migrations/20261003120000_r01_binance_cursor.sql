begin;
create table quantos.binance_ingestion_cursor (
 tenant_id uuid not null references quantos.tenants(id),
 provider text not null,
 symbol text not null check (symbol ~ '^[A-Z0-9]{2,32}$'),
 next_id bigint not null check(next_id >= 0),
 initial_id bigint not null check(initial_id >= 0),
 actor_id uuid not null,
 last_response_at timestamptz not null default now(),
 primary key(tenant_id,provider,symbol),
 foreign key(tenant_id,actor_id) references quantos.actors(tenant_id,id)
);
alter table quantos.binance_ingestion_cursor enable row level security;
alter table quantos.binance_ingestion_cursor force row level security;
revoke all on quantos.binance_ingestion_cursor from public,anon,authenticated;
grant select,insert,update on quantos.binance_ingestion_cursor to service_role;
create policy binance_cursor_backend on quantos.binance_ingestion_cursor for all to service_role using(true) with check(true);
-- Serialized page commit. Cursor, receipts, ledger, audit and outbox all roll back on any failure.
create function quantos.append_binance_page(t uuid, actor uuid, p text, s text, expected_id bigint, ticks jsonb)
 returns bigint language plpgsql security invoker set search_path='' as $$
declare c bigint; item jsonb; result record;
begin
 if expected_id < 0 or s !~ '^[A-Z0-9]{2,32}$' or jsonb_typeof(ticks) is distinct from 'array' or jsonb_array_length(ticks)>1000 then
  raise exception 'BINANCE_INVALID_PAGE' using errcode='22023';
 end if;
 if not exists(select 1 from quantos.actors where id=actor and tenant_id=t and is_active and actor_kind='service') then
  raise exception 'MARKET_ACTOR_NOT_AUTHORIZED' using errcode='42501';
 end if;
 insert into quantos.binance_ingestion_cursor(tenant_id,provider,symbol,next_id,initial_id,actor_id)
 values(t,p,s,expected_id,expected_id,actor) on conflict do nothing;
 select next_id into c from quantos.binance_ingestion_cursor where tenant_id=t and provider=p and symbol=s for update;
 if c is distinct from expected_id then raise exception 'BINANCE_CURSOR_CONFLICT' using errcode='40001'; end if;
 for item in select value from jsonb_array_elements(ticks) loop
  if (item->>'id')::bigint is distinct from c or item->>'source_id' is distinct from (s||':agg:'||c::text)
   or item->'events'->0->>'aggregate_id' is distinct from (p||':'||(item->>'canonical_symbol')) then
   raise exception 'BINANCE_SOURCE_GAP' using errcode='22023';
  end if;
  select * into result from quantos.append_market_source(t,actor,p,item->>'source_id',item->>'hash',item->'events');
  c:=c+1;
 end loop;
 update quantos.binance_ingestion_cursor set next_id=c,actor_id=actor,last_response_at=clock_timestamp()
 where tenant_id=t and provider=p and symbol=s;
 return c;
end;
$$;
revoke all on function quantos.append_binance_page(uuid,uuid,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function quantos.append_binance_page(uuid,uuid,text,text,bigint,jsonb) to service_role;
comment on table quantos.binance_ingestion_cursor is 'R01 aggregate-trade committed cursor; empty successful polls refresh transport health, silence of trades is not a transport failure.';
commit;
