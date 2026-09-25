-- The Runtime fixture stores private, content-addressed Artifacts here.
-- Provision the bucket with the schema so an otherwise migrated target cannot
-- pass database Gates while failing every real worker upload.
insert into storage.buckets (id, name, public)
values ('quantos-artifacts', 'quantos-artifacts', false)
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1 from storage.buckets
    where id = 'quantos-artifacts' and public
  ) then
    raise exception 'quantos-artifacts must be a private Storage bucket';
  end if;
end;
$$;
