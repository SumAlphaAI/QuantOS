// Minimal Supabase Storage catalog used by disposable CI databases.
// Keep bucket limits available to migrations as well as id/name/privacy.
const storageBucketsSql = `create table storage.buckets(
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint
);`;

module.exports = { storageBucketsSql };
