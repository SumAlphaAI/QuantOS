begin;

grant insert on quantos.operational_metric_samples to quantos_runtime;
grant execute on function quantos.record_operational_metric(
  uuid, text, double precision, text, uuid, jsonb, timestamptz
) to quantos_runtime;

create policy "operational_metric_samples_runtime_storage_insert"
  on quantos.operational_metric_samples
  for insert to quantos_runtime
  with check (metric_name = 'storage_operation_error'
    and source = 'storage_operation_error');

commit;
