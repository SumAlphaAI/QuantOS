// Preserve immutable migration bytes/checksums while making the one historical
// cluster-scoped role declaration safe across independent database rebuilds.
const {createHash}=require('node:crypto');
const snapshotMigration='20261007180000_r02_snapshot_boundaries.sql';
const snapshotChecksum='b58d2bef2dd9c9d313adc0f0a913a3ffffe3d75bef64c24bab8a99b797527406';
const declaration='create role quantos_snapshot_writer nologin;';
const snapshotRoleSql=`do $quantos_cluster_role$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname='quantos_snapshot_writer') then
    create role quantos_snapshot_writer nologin;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname='quantos_snapshot_writer'
    and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then
    raise exception 'MIGRATION_CLUSTER_ROLE: incompatible quantos_snapshot_writer attributes' using errcode='42501';
  end if;
end
$quantos_cluster_role$;`;

function migrationSql(filename,source) {
  if(filename!==snapshotMigration)return source;
  if(createHash('sha256').update(source).digest('hex')!==snapshotChecksum || source.split(declaration).length!==2)
    throw Error('MIGRATION_CHECKSUM: cluster-role adaptation requires the exact historical R02 migration');
  return source.replace(declaration,snapshotRoleSql);
}
function replayMigrationSql(filename,source,replaySchema) {
  if(!/^quantos_replay_[a-f0-9]{32}$/.test(replaySchema))throw Error('Invalid migration replay schema');
  // The R02 API schema is database-scoped too; it must not collide with the
  // already-applied API or change its grants/functions during rollback replay.
  return migrationSql(filename,source)
    .replace(/^\s*(begin|commit)\s*;\s*$/gim,'')
    .replace(/\bquantos_snapshot_api\b/g,`${replaySchema}_snapshot_api`)
    .replace(/\bquantos\b/g,replaySchema);
}
module.exports={migrationSql,replayMigrationSql,snapshotRoleSql};
