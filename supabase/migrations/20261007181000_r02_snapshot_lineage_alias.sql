begin;
-- Preserve the applied migration and failed receipt; qualify the JSON element alias.
create or replace function quantos.validate_snapshot_insert() returns trigger
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
    if not exists(select 1 from jsonb_array_elements(new.artifact_refs) entry(value) where entry.value->>'artifact_id'=l->>'reference') then
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
commit;
