begin;
-- Fail closed for historical records without a verifiable canonical payload.
-- Preserve old facts; valid replacements use new immutable snapshot IDs/hashes.
create function quantos.snapshot_read_valid(s quantos.data_snapshots) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p jsonb;
begin
 if s.canonical_payload is null or octet_length(s.canonical_payload)>1048576
    or s.content_hash is distinct from 'sha256:'||encode(sha256(convert_to(s.canonical_payload,'UTF8')),'hex') then
  return false; end if;
 p:=s.canonical_payload::jsonb;
 if s.schema_name<>'DataSnapshot' or s.schema_version<>'v1' or s.max_age_secs not between 0 and 86400
    or s.window_end_at<s.window_start_at or s.window_end_at>s.captured_at
    or s.captured_at>s.created_at or s.captured_at>clock_timestamp()
    or s.expires_at is distinct from s.captured_at+s.max_age_secs*interval '1 second'
    or (p->>'captured_at')::timestamptz is distinct from s.captured_at
    or (p->'window'->>'start_at')::timestamptz is distinct from s.window_start_at
    or (p->'window'->>'end_at')::timestamptz is distinct from s.window_end_at
    or p->>'schema_name' is distinct from s.schema_name or p->>'schema_version' is distinct from s.schema_version
    or (p->>'schema_entry_id')::uuid is distinct from s.schema_entry_id
    or (p->>'max_age_secs')::bigint is distinct from s.max_age_secs
    or p->>'quality' is distinct from s.quality or p->>'license_label' is distinct from s.license_label
    or p->'sources' is distinct from s.sources or p->'symbols' is distinct from s.symbols
    or p->'artifact_refs' is distinct from s.artifact_refs or p->'lineage' is distinct from s.lineage
    or p->'quality_findings' is distinct from s.quality_findings then
  return false; end if;
 return quantos.snapshot_references_valid(s);
exception when invalid_text_representation or invalid_parameter_value or datetime_field_overflow then return false;
end $$;
revoke all on function quantos.snapshot_read_valid(quantos.data_snapshots) from public,anon,authenticated,quantos_bff;
grant execute on function quantos.snapshot_read_valid(quantos.data_snapshots) to quantos_snapshot_writer;
create or replace function quantos_snapshot_api.read_snapshot(t uuid,s uuid) returns jsonb
language plpgsql security definer stable set search_path='' as $$
declare d quantos.data_snapshots;
begin
 if not quantos.is_tenant_member(t) then raise exception 'SNAPSHOT_MEMBER_REQUIRED' using errcode='42501'; end if;
 select * into d from quantos.data_snapshots where tenant_id=t and id=s;
 if not found then return null; end if;
 if not quantos.snapshot_read_valid(d) then raise exception 'SNAPSHOT_READ_INVALID' using errcode='22023'; end if;
 return quantos.snapshot_document(d);
end $$;
commit;
