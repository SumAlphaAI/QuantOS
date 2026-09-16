begin;

create or replace function quantos.reject_data_snapshot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'DATA_SNAPSHOT_IMMUTABLE: create a new snapshot instead of updating an existing record';
end;
$$;

drop trigger if exists trg_data_snapshots_reject_update on quantos.data_snapshots;
create trigger trg_data_snapshots_reject_update
before update on quantos.data_snapshots
for each row execute function quantos.reject_data_snapshot_update();

comment on function quantos.reject_data_snapshot_update() is
  'R02 immutable metadata guard. Retention deletion remains separately governed.';

commit;
