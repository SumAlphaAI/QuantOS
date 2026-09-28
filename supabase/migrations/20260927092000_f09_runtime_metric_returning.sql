begin;

-- record_operational_metric uses INSERT ... RETURNING id. PostgreSQL requires
-- column SELECT privilege and a matching SELECT RLS policy for that return.
grant select (id) on quantos.operational_metric_samples to quantos_runtime;
create policy "operational_metric_samples_runtime_storage_id_select"
  on quantos.operational_metric_samples
  for select to quantos_runtime
  using (metric_name = 'storage_operation_error');

commit;
