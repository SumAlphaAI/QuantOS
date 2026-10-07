begin;
-- Verified Supabase provisioning login: postgres already owns all five
-- functions and already has ADMIN membership, with SET=false/INHERIT=false.
-- Enable restriction testing; do not enable inheritance or table grants.
grant quantos_snapshot_writer to postgres with set true;
commit;
