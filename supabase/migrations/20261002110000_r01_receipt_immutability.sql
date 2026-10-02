begin;
create trigger market_source_receipt_append_only
before update or delete or truncate on quantos.market_source_receipt
for each statement execute function quantos.reject_append_only_mutation();
commit;
