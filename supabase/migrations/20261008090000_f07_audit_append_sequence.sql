-- Preserve every historical audit value: existing rows keep NULL sequence.
-- Only future inserts get an authoritative database append ordinal.
create sequence quantos.audit_append_sequence as bigint;
alter table quantos.audit_entries add column append_sequence bigint;
alter sequence quantos.audit_append_sequence owned by quantos.audit_entries.append_sequence;
revoke all on sequence quantos.audit_append_sequence from public;

create function quantos.assign_audit_append_sequence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Ignore a caller-supplied value; the ordinal belongs to the database writer.
  new.append_sequence := nextval('quantos.audit_append_sequence'::regclass);
  return new;
end $$;
revoke all on function quantos.assign_audit_append_sequence() from public;
create trigger assign_audit_append_sequence
before insert on quantos.audit_entries for each row
execute function quantos.assign_audit_append_sequence();
create unique index idx_audit_append_sequence
on quantos.audit_entries(append_sequence) where append_sequence is not null;
comment on column quantos.audit_entries.append_sequence is
'Authoritative insertion ordinal for new audit entries; NULL on historical entries whose tie order is unknown. Gaps are permitted. Per-run serialized transitions retain causal order; this is not a global commit-order claim.';
