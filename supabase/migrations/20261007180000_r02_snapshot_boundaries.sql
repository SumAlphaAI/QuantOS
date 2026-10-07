begin;
-- Forward-only: historical immutable rows, failed probes and audit entries stay unchanged.
create schema quantos_snapshot_api;
revoke all on schema quantos_snapshot_api from public;
create role quantos_snapshot_writer nologin;
grant usage on schema quantos to quantos_snapshot_writer;
grant usage on schema quantos_snapshot_api to authenticated, quantos_bff;

alter table quantos.data_snapshots add column canonical_payload text,
 add column created_by uuid, add column correlation_id uuid, add column causation_id uuid;
alter table quantos.data_snapshot_quality_rules add column revision bigint not null default 0;

create function quantos.snapshot_document(s quantos.data_snapshots) returns jsonb
language sql immutable set search_path='' as $$
 select (to_jsonb(s)-'id'-'window_start_at'-'window_end_at'-'canonical_payload'-'created_by'-'correlation_id'-'causation_id')
 || jsonb_build_object('snapshot_id',s.id,'window',jsonb_build_object('start_at',s.window_start_at,'end_at',s.window_end_at));
$$;
revoke all on function quantos.snapshot_document(quantos.data_snapshots) from public;

create function quantos.assert_snapshot_actor(c jsonb,t uuid,cap text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if c->>'tenant_id' is distinct from t::text or coalesce(length(btrim(c->>'reason')),0) not between 1 and 512
   or (c->>'correlation_id')::uuid is null or (c->>'correlation_id')::uuid='00000000-0000-0000-0000-000000000000'
   or (c->>'causation_id')::uuid is null or (c->>'causation_id')::uuid='00000000-0000-0000-0000-000000000000'
   or not exists(select 1 from quantos.actors a join quantos.actor_capabilities g on g.tenant_id=a.tenant_id and g.actor_id=a.id
    where a.id=(c->>'actor_id')::uuid and a.tenant_id=t and a.is_active and g.capability=cap
      and g.mode_scope is null and g.account_id is null
      and (a.actor_kind='service' or (a.actor_kind='user' and a.user_id=auth.uid()))) then
  raise exception 'SNAPSHOT_ACTOR_NOT_AUTHORIZED' using errcode='42501';
 end if;
end $$;
revoke all on function quantos.assert_snapshot_actor(jsonb,uuid,text) from public,anon,authenticated,quantos_bff;

create function quantos.validate_snapshot_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare p jsonb; a jsonb; l jsonb; lo bigint; hi bigint; n bigint; c jsonb;
begin
 c := nullif(current_setting('quantos.snapshot_context',true),'')::jsonb;
 perform quantos.assert_snapshot_actor(c,new.tenant_id,'snapshot.write');
 if new.canonical_payload is null or octet_length(new.canonical_payload)>1048576
    or new.content_hash is distinct from 'sha256:'||encode(sha256(convert_to(new.canonical_payload,'UTF8')),'hex') then
  raise exception 'SNAPSHOT_INTEGRITY' using errcode='22023'; end if;
 p:=new.canonical_payload::jsonb;
 if new.schema_name<>'DataSnapshot' or new.schema_version<>'v1' or new.max_age_secs not between 0 and 86400
    or new.window_end_at<new.window_start_at or new.window_end_at>new.captured_at
    or new.captured_at>new.created_at or new.captured_at>clock_timestamp()
    or new.expires_at is distinct from new.captured_at+new.max_age_secs*interval '1 second'
    or (p->>'captured_at')::timestamptz is distinct from new.captured_at
    or (p->'window'->>'start_at')::timestamptz is distinct from new.window_start_at
    or (p->'window'->>'end_at')::timestamptz is distinct from new.window_end_at
    or p->>'schema_name' is distinct from new.schema_name or p->>'schema_version' is distinct from new.schema_version
    or (p->>'schema_entry_id')::uuid is distinct from new.schema_entry_id
    or (p->>'max_age_secs')::bigint is distinct from new.max_age_secs
    or p->>'quality' is distinct from new.quality or p->>'license_label' is distinct from new.license_label
    or p->'sources' is distinct from new.sources or p->'symbols' is distinct from new.symbols
    or p->'artifact_refs' is distinct from new.artifact_refs or p->'lineage' is distinct from new.lineage
    or p->'quality_findings' is distinct from new.quality_findings then
  raise exception 'SNAPSHOT_INTEGRITY' using errcode='22023'; end if;
 if new.created_by is distinct from (c->>'actor_id')::uuid or new.correlation_id is distinct from (c->>'correlation_id')::uuid
    or new.causation_id is distinct from (c->>'causation_id')::uuid then raise exception 'SNAPSHOT_WRITE_CONTEXT' using errcode='42501'; end if;
 if not exists(select 1 from quantos.schema_registry s where s.id=new.schema_entry_id and s.tenant_id=new.tenant_id
   and s.schema_name=new.schema_name and s.schema_version=new.schema_version) then
  raise exception 'SNAPSHOT_SCHEMA_REFERENCE' using errcode='23503'; end if;
 for a in select v from (values(new.sources),(new.lineage),(new.artifact_refs),(new.symbols),(new.quality_findings)) q(v) loop
  if jsonb_typeof(a) is distinct from 'array' or jsonb_array_length(a)>1024 then raise exception 'SNAPSHOT_INPUT_BUDGET' using errcode='22023'; end if;
 end loop;
 if jsonb_array_length(new.sources)=0 or jsonb_array_length(new.lineage)=0 then raise exception 'SNAPSHOT_SOURCE_LINEAGE_REQUIRED' using errcode='22023'; end if;
 for a in select value from jsonb_array_elements(new.sources) loop
  if coalesce(btrim(a->>'source_id'),'')='' or coalesce(btrim(a->>'provider'),'')='' or coalesce(btrim(a->>'dataset'),'')='' then
   raise exception 'SNAPSHOT_SOURCE_IDENTITY' using errcode='22023'; end if;
 end loop;
 for a in select value from jsonb_array_elements(new.artifact_refs) loop
  if not exists(select 1 from quantos.object_artifacts o where o.tenant_id=new.tenant_id and o.artifact_id=(a->>'artifact_id')::uuid
    and o.content_hash=a->>'content_hash' and o.storage_bucket=a->>'storage_bucket' and o.object_key=a->>'object_key' and o.media_type=a->>'media_type') then
   raise exception 'SNAPSHOT_ARTIFACT_REFERENCE' using errcode='23503'; end if;
 end loop;
 for l in select value from jsonb_array_elements(new.lineage) loop
  if jsonb_typeof(l->'details') is distinct from 'object' or coalesce(btrim(l->>'reference'),'')='' then raise exception 'SNAPSHOT_LINEAGE' using errcode='22023'; end if;
  case l->>'lineage_kind'
   when 'artifact' then
    if not exists(select 1 from jsonb_array_elements(new.artifact_refs) a where a->>'artifact_id'=l->>'reference') then
     raise exception 'SNAPSHOT_LINEAGE_ARTIFACT' using errcode='23503'; end if;
   when 'schema_registry' then
    if l->>'reference' is distinct from new.schema_entry_id::text then raise exception 'SNAPSHOT_LINEAGE_SCHEMA' using errcode='23503'; end if;
   when 'market_event_range' then
    lo:=coalesce(l->'details'->>'from_sequence',l->'details'->>'first_sequence')::bigint;
    hi:=coalesce(l->'details'->>'to_sequence',l->'details'->>'last_sequence')::bigint;
    if lo is null or hi is null or lo<1 or hi<lo or hi-lo>1000000 then raise exception 'SNAPSHOT_LINEAGE_RANGE' using errcode='22023'; end if;
    select count(*) into n from quantos.event_log e where e.tenant_id=new.tenant_id and e.aggregate_type='market'
      and e.aggregate_id=substring(l->>'reference' from 8) and e.sequence between lo and hi;
    if left(l->>'reference',7)<>'market:' or n<>hi-lo+1 then raise exception 'SNAPSHOT_LINEAGE_RANGE_REFERENCE' using errcode='23503'; end if;
   else raise exception 'SNAPSHOT_LINEAGE_KIND' using errcode='22023';
  end case;
 end loop;
 return new;
end $$;
revoke all on function quantos.validate_snapshot_insert() from public;
create trigger r02_validate_snapshot before insert on quantos.data_snapshots for each row execute function quantos.validate_snapshot_insert();

create function quantos.audit_snapshot_mutation() returns trigger
language plpgsql security definer set search_path='' as $$
declare c jsonb; cap text; action text;
begin
 c:=nullif(current_setting('quantos.snapshot_context',true),'')::jsonb;
 if tg_table_name='data_snapshots' then cap:='snapshot.write';action:='snapshot.created';
 else cap:='snapshot.rule.write';action:='snapshot.rule.changed'; end if;
 perform quantos.assert_snapshot_actor(c,new.tenant_id,cap);
 insert into quantos.audit_entries(tenant_id,actor_id,correlation_id,causation_id,action,details)
 values(new.tenant_id,(c->>'actor_id')::uuid,(c->>'correlation_id')::uuid,(c->>'causation_id')::uuid,action,
   jsonb_build_object('reason',c->>'reason','record',to_jsonb(new)-'canonical_payload'));
 return new;
end $$;
revoke all on function quantos.audit_snapshot_mutation() from public;
create trigger r02_snapshot_audit after insert on quantos.data_snapshots for each row execute function quantos.audit_snapshot_mutation();
create trigger r02_rule_audit after insert or update on quantos.data_snapshot_quality_rules for each row execute function quantos.audit_snapshot_mutation();
alter table quantos.data_snapshot_quality_rules add constraint r02_trading_floor check
 (usage_scope='research' or (not allow_pending and not allow_degraded and not allow_failed and require_license and require_freshness)) not valid;

create function quantos.persist_data_snapshot(d jsonb,canonical text,c jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s quantos.data_snapshots; result quantos.data_snapshots; prior text;
begin
 perform quantos.assert_snapshot_actor(c,(d->>'tenant_id')::uuid,'snapshot.write');
 prior:=current_setting('quantos.snapshot_context',true); perform set_config('quantos.snapshot_context',c::text,true);
 s:=jsonb_populate_record(null::quantos.data_snapshots,(d-'snapshot_id'-'window')||jsonb_build_object('id',d->>'snapshot_id',
  'window_start_at',d->'window'->>'start_at','window_end_at',d->'window'->>'end_at','canonical_payload',canonical,
  'created_by',c->>'actor_id','correlation_id',c->>'correlation_id','causation_id',c->>'causation_id'));
 insert into quantos.data_snapshots select (s).* on conflict(tenant_id,content_hash) do nothing returning * into result;
 if not found then select * into result from quantos.data_snapshots where tenant_id=s.tenant_id and content_hash=s.content_hash; end if;
 perform set_config('quantos.snapshot_context',coalesce(prior,''),true);
 return quantos.snapshot_document(result);
end $$;

create function quantos.persist_snapshot_quality_rule(d jsonb,c jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r quantos.data_snapshot_quality_rules; prior text;
begin
 perform quantos.assert_snapshot_actor(c,(d->>'tenant_id')::uuid,'snapshot.rule.write');
 prior:=current_setting('quantos.snapshot_context',true); perform set_config('quantos.snapshot_context',c::text,true);
 insert into quantos.data_snapshot_quality_rules(tenant_id,usage_scope,allow_pending,allow_degraded,allow_failed,require_license,require_freshness,updated_at,revision)
 values((d->>'tenant_id')::uuid,d->>'usage',(d->>'allow_pending')::boolean,(d->>'allow_degraded')::boolean,(d->>'allow_failed')::boolean,
 (d->>'require_license')::boolean,(d->>'require_freshness')::boolean,clock_timestamp(),1)
 on conflict(tenant_id,usage_scope) do update set allow_pending=excluded.allow_pending,allow_degraded=excluded.allow_degraded,
 allow_failed=excluded.allow_failed,require_license=excluded.require_license,require_freshness=excluded.require_freshness,
 updated_at=excluded.updated_at,revision=quantos.data_snapshot_quality_rules.revision+1 returning * into r;
 perform set_config('quantos.snapshot_context',coalesce(prior,''),true);
 return (to_jsonb(r)-'usage_scope')||jsonb_build_object('usage',r.usage_scope);
end $$;
revoke all on function quantos.persist_data_snapshot(jsonb,text,jsonb),quantos.persist_snapshot_quality_rule(jsonb,jsonb) from public,anon,authenticated,quantos_bff;
grant execute on function quantos.persist_data_snapshot(jsonb,text,jsonb),quantos.persist_snapshot_quality_rule(jsonb,jsonb) to quantos_snapshot_writer;

-- Narrow API schema exposes no quantos table grants or unauthenticated entry point.
create function quantos_snapshot_api.read_snapshot(t uuid,s uuid) returns jsonb
language plpgsql security definer stable set search_path='' as $$
declare result jsonb;
begin
 if not quantos.is_tenant_member(t) then raise exception 'SNAPSHOT_MEMBER_REQUIRED' using errcode='42501'; end if;
 select quantos.snapshot_document(d) into result from quantos.data_snapshots d where d.tenant_id=t and d.id=s;
 return result;
end $$;
create function quantos_snapshot_api.read_quality_rules(t uuid) returns jsonb
language plpgsql security definer stable set search_path='' as $$
begin
 if not quantos.is_tenant_member(t) then raise exception 'SNAPSHOT_MEMBER_REQUIRED' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg((to_jsonb(r)-'usage_scope')||jsonb_build_object('usage',r.usage_scope) order by r.usage_scope),'[]'::jsonb)
  from quantos.data_snapshot_quality_rules r where r.tenant_id=t);
end $$;
revoke all on function quantos_snapshot_api.read_snapshot(uuid,uuid),quantos_snapshot_api.read_quality_rules(uuid) from public,anon;
grant execute on function quantos_snapshot_api.read_snapshot(uuid,uuid),quantos_snapshot_api.read_quality_rules(uuid) to authenticated,quantos_bff;

-- Recovery intent precedes HTTP. Reconcile only verifies/re-registers; it never deletes.
create table quantos.artifact_upload_attempts(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references quantos.tenants(id),
 actor_id uuid not null, correlation_id uuid not null, causation_id uuid not null,
 manifest jsonb not null, state text not null check(state in('prepared','reconcile','registered')),
 attempts integer not null default 0, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(tenant_id,actor_id) references quantos.actors(tenant_id,id));
alter table quantos.artifact_upload_attempts enable row level security;
alter table quantos.artifact_upload_attempts force row level security;
revoke all on quantos.artifact_upload_attempts from public,anon,authenticated,quantos_bff;
create function quantos.prepare_artifact_upload(d jsonb,c jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid; id uuid; h text; k text;
begin
 t:=(d->>'tenant_id')::uuid;perform quantos.assert_snapshot_actor(c,t,'artifact.write');
 h:=d->>'content_hash';k:='tenant/'||t::text||'/artifacts/'||substring(h from 8 for 2)||'/'||substring(h from 8);
 if h !~ '^sha256:[0-9a-f]{64}$' or d->>'object_key' is distinct from k
   or coalesce(btrim(d->>'storage_bucket'),'')='' or (d->>'size_bytes')::bigint<0 then raise exception 'ARTIFACT_INVALID_MANIFEST' using errcode='22023'; end if;
 if exists(select 1 from quantos.object_artifacts o where o.tenant_id=t and o.content_hash=h
   and (o.object_key<>k or o.storage_bucket<>d->>'storage_bucket' or o.media_type<>d->>'media_type' or o.size_bytes<>(d->>'size_bytes')::bigint)) then
  raise exception 'ARTIFACT_EXISTING_MANIFEST_CONFLICT' using errcode='23505'; end if;
 insert into quantos.artifact_upload_attempts(tenant_id,actor_id,correlation_id,causation_id,manifest,state)
 values(t,(c->>'actor_id')::uuid,(c->>'correlation_id')::uuid,(c->>'causation_id')::uuid,d,'prepared') returning artifact_upload_attempts.id into id;
 insert into quantos.audit_entries(tenant_id,actor_id,correlation_id,causation_id,action,details)
 values(t,(c->>'actor_id')::uuid,(c->>'correlation_id')::uuid,(c->>'causation_id')::uuid,'artifact.upload.prepared',jsonb_build_object('attempt_id',id,'reason',c->>'reason'));
 return id;
end $$;
create function quantos.finish_artifact_upload(id uuid,registered boolean,c jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare a quantos.artifact_upload_attempts;
begin
 select * into a from quantos.artifact_upload_attempts where artifact_upload_attempts.id=finish_artifact_upload.id for update;
 if not found then raise exception 'ARTIFACT_ATTEMPT_MISSING' using errcode='22023'; end if;
 perform quantos.assert_snapshot_actor(c,a.tenant_id,'artifact.write');
 if registered and not exists(select 1 from quantos.object_artifacts o where o.tenant_id=a.tenant_id
   and o.content_hash=a.manifest->>'content_hash' and o.storage_bucket=a.manifest->>'storage_bucket' and o.object_key=a.manifest->>'object_key') then
  raise exception 'ARTIFACT_REGISTRATION_MISSING' using errcode='23503'; end if;
 if a.state='registered' and not registered then return; end if;
 update quantos.artifact_upload_attempts set state=case when registered then 'registered' else 'reconcile' end,
  attempts=attempts+1,updated_at=clock_timestamp() where artifact_upload_attempts.id=finish_artifact_upload.id;
 insert into quantos.audit_entries(tenant_id,actor_id,correlation_id,causation_id,action,details)
 values(a.tenant_id,(c->>'actor_id')::uuid,(c->>'correlation_id')::uuid,(c->>'causation_id')::uuid,'artifact.upload.reconciled',
 jsonb_build_object('attempt_id',id,'registered',registered,'reason',c->>'reason'));
end $$;
create function quantos.artifact_upload_manifest(id uuid,c jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a quantos.artifact_upload_attempts;
begin
 select * into a from quantos.artifact_upload_attempts where artifact_upload_attempts.id=artifact_upload_manifest.id;
 if not found then raise exception 'ARTIFACT_ATTEMPT_MISSING' using errcode='22023'; end if;
 perform quantos.assert_snapshot_actor(c,a.tenant_id,'artifact.write');return a.manifest;
end $$;
revoke all on function quantos.prepare_artifact_upload(jsonb,jsonb),quantos.finish_artifact_upload(uuid,boolean,jsonb),quantos.artifact_upload_manifest(uuid,jsonb) from public,anon,authenticated,quantos_bff;
grant execute on function quantos.prepare_artifact_upload(jsonb,jsonb),quantos.finish_artifact_upload(uuid,boolean,jsonb),quantos.artifact_upload_manifest(uuid,jsonb) to quantos_snapshot_writer;
comment on table quantos.artifact_upload_attempts is 'R02 durable recovery queue: retry prepared/reconcile attempts after GET/hash verification; never compensate by deleting an existing key.';
commit;
