begin;
-- RLS actor predicates and deterministic ledger snapshot order share this
-- index; unrelated tenants/actors do not require a full audit-table scan.
create index if not exists audit_entries_bff_actor_time
 on quantos.audit_entries(tenant_id,actor_id,recorded_at,id);
create index if not exists bff_audit_cursor_expiry
 on quantos.bff_audit_cursors(expires_at);
create index if not exists bff_export_ticket_expiry
 on quantos.bff_export_tickets(export_id,expires_at) where consumed_at is null and revoked_at is null;
commit;
