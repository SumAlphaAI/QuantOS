-- NOT RUN. Execute only after the configured DEVELOPMENT Supabase is writable.
-- This retires only the fixture observed in database-readonly-probe.json.
-- It does not remove audit/history or change provider facts/server settings.
BEGIN;
DO $$
BEGIN
  IF pg_is_in_recovery() OR current_setting('transaction_read_only')::boolean THEN
    RAISE EXCEPTION 'development target must first be restored to writable state';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM quantos.tenants
    WHERE id='01a12acb-6530-7432-88b5-a71f4ee28668'::uuid
      AND slug='f07-01a12acb-6530-7432-88b5-a71f4ee28668'
  ) THEN
    RAISE EXCEPTION 'expected assessment fixture identity missing';
  END IF;
END $$;
UPDATE quantos.workflow_runs
SET status='failed', completed_at=now(), lease_owner=null,
    lease_expires_at=null, attempt_id=null,
    last_error='F07 read-only-interrupted fixture retired', updated_at=now()
WHERE tenant_id='01a12acb-6530-7432-88b5-a71f4ee28668'::uuid
  AND status IN ('queued','running','cancel_requested')
RETURNING id;
UPDATE quantos.tool_registry
SET enabled=false, updated_at=now()
WHERE tenant_id='01a12acb-6530-7432-88b5-a71f4ee28668'::uuid AND enabled=true
RETURNING id;
SELECT count(*) AS pending_must_be_zero
FROM quantos.workflow_runs
WHERE tenant_id='01a12acb-6530-7432-88b5-a71f4ee28668'::uuid
  AND status IN ('queued','running','cancel_requested');
COMMIT;
