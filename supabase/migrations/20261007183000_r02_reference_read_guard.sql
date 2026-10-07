begin;
-- Legacy facts are retained. Resolve references again at the consumption/read
-- boundary; an old valid hash does not certify an invalid schema/artifact link.
create function quantos.snapshot_references_valid(s quantos.data_snapshots) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare a jsonb; l jsonb;
begin
 if not exists(select 1 from quantos.schema_registry r where r.id=s.schema_entry_id and r.tenant_id=s.tenant_id
   and r.schema_name=s.schema_name and r.schema_version=s.schema_version) then return false; end if;
 if jsonb_typeof(s.artifact_refs) is distinct from 'array' or jsonb_typeof(s.lineage) is distinct from 'array'
    or jsonb_array_length(s.lineage)=0 then return false; end if;
 for a in select value from jsonb_array_elements(s.artifact_refs) loop
  if not exists(select 1 from quantos.object_artifacts o where o.tenant_id=s.tenant_id and o.artifact_id=(a->>'artifact_id')::uuid
    and o.content_hash=a->>'content_hash' and o.storage_bucket=a->>'storage_bucket' and o.object_key=a->>'object_key' and o.media_type=a->>'media_type') then return false; end if;
 end loop;
 for l in select value from jsonb_array_elements(s.lineage) loop
  case l->>'lineage_kind'
   when 'artifact' then
    if not exists(select 1 from jsonb_array_elements(s.artifact_refs) entry(value) where entry.value->>'artifact_id'=l->>'reference') then return false; end if;
   when 'schema_registry' then if l->>'reference' is distinct from s.schema_entry_id::text then return false; end if;
   when 'market_event_range' then
    if not exists(select 1 from quantos.event_log e where e.tenant_id=s.tenant_id and e.aggregate_type='market'
      and e.aggregate_id=substring(l->>'reference' from 8)
      and e.sequence=coalesce(l->'details'->>'to_sequence',l->'details'->>'last_sequence')::bigint) then return false; end if;
   else return false;
  end case;
 end loop;
 return true;
exception when invalid_text_representation or invalid_parameter_value then return false;
end $$;
revoke all on function quantos.snapshot_references_valid(quantos.data_snapshots) from public,anon,authenticated,quantos_bff;
grant execute on function quantos.snapshot_references_valid(quantos.data_snapshots) to quantos_snapshot_writer;
create or replace function quantos_snapshot_api.read_snapshot(t uuid,s uuid) returns jsonb
language plpgsql security definer stable set search_path='' as $$
declare d quantos.data_snapshots;
begin
 if not quantos.is_tenant_member(t) then raise exception 'SNAPSHOT_MEMBER_REQUIRED' using errcode='42501'; end if;
 select * into d from quantos.data_snapshots where tenant_id=t and id=s;
 if not found then return null; end if;
 if not quantos.snapshot_references_valid(d) then raise exception 'SNAPSHOT_REFERENCE_INVALID' using errcode='22023'; end if;
 return quantos.snapshot_document(d);
end $$;
commit;
