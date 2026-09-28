begin;

grant select (id) on quantos.operational_metric_samples
  to quantos_execution_gateway;
create policy "operational_metric_samples_execution_secret_id_select"
  on quantos.operational_metric_samples
  for select to quantos_execution_gateway
  using (metric_name in ('secret_rotation_failure', 'secret_read_failure'));

commit;
