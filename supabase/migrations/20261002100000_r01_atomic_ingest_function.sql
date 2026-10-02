begin;
-- SECURITY INVOKER: the service must already hold the backend table privileges.
create function quantos.append_market_source(
  target_tenant uuid, target_actor uuid, source_provider text, source_id text,
  content_hash text, events jsonb
) returns table(inserted boolean, first_sequence bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  receipt_id uuid; prior_hash text; stream uuid; next_seq bigint;
  e jsonb; log_id uuid; aggregate_key text;
begin
  if jsonb_typeof(events) <> 'array' or jsonb_array_length(events) not between 1 and 3
    or length(btrim(source_provider)) not between 1 and 256 or length(btrim(source_id)) not between 1 and 256 then
    raise exception 'MARKET_INVALID_IDENTITY' using errcode='22023';
  end if;
  if not exists(select 1 from quantos.actors where id=target_actor and tenant_id=target_tenant and is_active and actor_kind='service') then
    raise exception 'MARKET_ACTOR_NOT_AUTHORIZED' using errcode='42501';
  end if;
  aggregate_key := events->0->>'aggregate_id';
  for e in select value from jsonb_array_elements(events) loop
    if (e->>'tenant_id')::uuid is distinct from target_tenant or (e->>'actor_id')::uuid is distinct from target_actor
      or e->>'aggregate_type' is distinct from 'market' or e->>'aggregate_id' is distinct from aggregate_key
      or e->>'schema_version' is distinct from 'v2' then
      raise exception 'MARKET_INVALID_IDENTITY' using errcode='22023';
    end if;
  end loop;
  insert into quantos.market_source_receipt(tenant_id,provider,source_tick_id,source_hash,actor_id,event_count,event_time)
    values(target_tenant,source_provider,source_id,content_hash,target_actor,jsonb_array_length(events),(events->0->>'occurred_at')::timestamptz)
    on conflict(tenant_id,provider,source_tick_id) do nothing returning id into receipt_id;
  if receipt_id is null then
    select source_hash into prior_hash from quantos.market_source_receipt where tenant_id=target_tenant and provider=source_provider and source_tick_id=source_id;
    if prior_hash is distinct from content_hash then raise exception 'MARKET_SOURCE_CONFLICT' using errcode='23505'; end if;
    return query select false,0::bigint; return;
  end if;
  insert into quantos.event_streams(tenant_id,aggregate_type,aggregate_id)
    values(target_tenant,'market',aggregate_key) on conflict(tenant_id,aggregate_type,aggregate_id)
    do update set updated_at=now() returning id into stream;
  perform 1 from quantos.event_streams where id=stream for update;
  select coalesce(max(sequence),0)+1 into next_seq from quantos.event_log where stream_id=stream;
  first_sequence := next_seq;
  for e in select value from jsonb_array_elements(events) loop
    insert into quantos.event_log(tenant_id,stream_id,event_id,actor_id,correlation_id,causation_id,aggregate_type,aggregate_id,sequence,event_kind,schema_version,payload,payload_hash,occurred_at)
      values(target_tenant,stream,(e->>'event_id')::uuid,target_actor,(e->>'correlation_id')::uuid,(e->>'causation_id')::uuid,'market',aggregate_key,next_seq,e->>'event_kind','v2',e->'payload',e->>'payload_hash',(e->>'occurred_at')::timestamptz)
      returning id into log_id;
    insert into quantos.audit_entries(tenant_id,actor_id,correlation_id,causation_id,event_id,action,details,recorded_at)
      values(target_tenant,target_actor,(e->>'correlation_id')::uuid,(e->>'causation_id')::uuid,(e->>'event_id')::uuid,'event.appended',jsonb_build_object('event_kind',e->>'event_kind','payload_hash',e->>'payload_hash','sequence',next_seq),(e->>'occurred_at')::timestamptz);
    insert into quantos.outbox_event(tenant_id,event_log_id,topic,status,attempts,available_at)
      values(target_tenant,log_id,'market.'||(e->>'event_kind'),'pending',0,(e->>'occurred_at')::timestamptz);
    next_seq := next_seq+1;
  end loop;
  inserted := true; return next;
end;
$$;
revoke all on function quantos.append_market_source(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function quantos.append_market_source(uuid,uuid,text,text,text,jsonb) to service_role;
comment on function quantos.append_market_source(uuid,uuid,text,text,text,jsonb) is 'R01 one-round-trip atomic receipt, sequence, event, audit and outbox append; conflict or any constraint failure rolls back the entire statement.';
commit;
