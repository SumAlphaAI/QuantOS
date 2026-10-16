import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20261016140000_x01_coherent_portfolio_snapshots.sql','utf8');
function check(text){
 assert(/^begin;[\s\S]*commit;\s*$/.test(text),'transaction boundary required');
 for(const table of ['accounts','positions'])assert(new RegExp('portfolio_'+table+'_tenant_account_fk\\s+foreign key \\(tenant_id, account_id\\) references quantos.accounts\\(tenant_id, id\\)').test(text),'composite tenant/account FK missing');
 for(const table of ['accounts','positions','marks'])assert(text.includes('alter table quantos.portfolio_'+table+' force row level security;'),'forced RLS missing');
 for(const term of ['add column snapshot_json jsonb','add column risk_input_json jsonb',"risk_input_json->'portfolio' = snapshot_json",'new.last_event_sequence < old.last_event_sequence','new.snapshot_json is distinct from old.snapshot_json','new.as_of < old.as_of','before update on quantos.portfolio_accounts','set search_path = \'\'','revoke insert, update, delete',') is true))'])assert(text.includes(term),'missing binding/monotonic/privilege obligation: '+term);
 assert(!/grant\s+(all|insert|update|delete)[\s\S]*?to\s+(anon|authenticated)\s*;/i.test(text),'member write privilege');
 return {status:'PASS',scope:'STATIC_ONLY',databaseExecution:false};
}
test('X01 migration static obligations preserve target NOT_RUN',()=>assert.equal(check(sql).databaseExecution,false));
for(const term of ['portfolio_accounts_tenant_account_fk','portfolio_positions_tenant_account_fk','force row level security','add column snapshot_json jsonb',"risk_input_json->'portfolio' = snapshot_json",'new.last_event_sequence < old.last_event_sequence','new.snapshot_json is distinct from old.snapshot_json','new.as_of < old.as_of','revoke insert, update, delete',') is true))'])test('rejects removed schema obligation '+term,()=>assert.throws(()=>check(sql.replaceAll(term,'REMOVED'))));
test('rejects accidental authenticated projection writes',()=>assert.throws(()=>check(sql+'\ngrant update on quantos.portfolio_accounts to authenticated;')));
