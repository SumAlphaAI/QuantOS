const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync,execFileSync}=require('node:child_process');
const {Client}=require('pg');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'artifacts/f02/database.json');
const receipt={status:'RUNNING',passed:false,source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),checks:[]};
function save(){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');}
async function main(){
 save();
 const url=new URL(process.env.F02_PG_ADMIN_URL ?? '');
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('F02 database gate requires an explicitly provided disposable loopback PostgreSQL');
 const admin=new Client({connectionString:url.toString()});await admin.connect();
 const names=['f02_target_','f02_reference_'].map(n=>n+crypto.randomBytes(6).toString('hex'));
 const urls=names.map(n=>{const v=new URL(url);v.pathname='/'+n;return v.toString()});
 const clients=[];
 function gate(command,pattern){
  const p=spawnSync(process.execPath,[path.join(root,'scripts/db-cli.cjs'),command],{cwd:root,env:{...process.env,DATABASE_URL:urls[0],QUANTOS_REFERENCE_DATABASE_URL:urls[1]},encoding:'utf8'});
  if(pattern){if(p.status===0||!pattern.test(p.stderr))throw Error(`Expected rejection ${command}: ${p.stderr}`);}else if(p.status!==0)throw Error(p.stderr);
 }
 try{
  for(const role of ['authenticated','anon','service_role'])await admin.query(`do $$ begin if not exists(select from pg_roles where rolname='${role}') then create role ${role} nologin; end if; end $$`);
  for(let i=0;i<names.length;i++){
   await admin.query(`create database ${names[i]}`);
   const c=new Client({connectionString:urls[i]});await c.connect();clients.push(c);
   await c.query(`create schema auth; create schema extensions; create schema storage;
     create table auth.users(id uuid primary key);
     create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
     create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
     grant usage on schema auth to authenticated,anon,service_role;`);
   const p=spawnSync(process.execPath,[path.join(root,'scripts/db-cli.cjs'),'apply'],{cwd:root,env:{...process.env,DATABASE_URL:urls[i]},encoding:'utf8'});
   if(p.status!==0)throw Error(p.stderr);
   // Explicit Supabase API grants fixture: RLS, not a missing SQL grant, must deny.
   await c.query(`grant usage on schema quantos to authenticated,anon; grant select,insert,update,delete on all tables in schema quantos to authenticated,anon;`);
  }
  const c=clients[0];
  const alias=new URL(urls[0]);alias.searchParams.set('application_name','f02-reference-alias');
  const self=spawnSync(process.execPath,[path.join(root,'scripts/db-cli.cjs'),'schema-diff'],{cwd:root,env:{...process.env,DATABASE_URL:urls[0],QUANTOS_REFERENCE_DATABASE_URL:alias.toString()},encoding:'utf8'});
  if(self.status===0||!self.stderr.includes('independent of target'))throw Error('Schema self-comparison was accepted');
  receipt.checks.push('reject same database through a differently encoded reference URL');
  gate('schema-diff');gate('live-rls');gate('replay-check');receipt.checks.push('fresh rebuild, checksum/catalog equality, RLS catalog and replay');
  for(const [sql,pattern,label] of [
   ['alter table quantos.tenants disable row level security',/RLS is disabled/,'disable RLS'],
   ['alter table quantos.tenants no force row level security',/FORCE RLS/,'remove FORCE'],
   [`do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='quantos' and tablename='tenants' loop execute format('drop policy %I on quantos.tenants',p.policyname);end loop;end $$`,/policies are missing/,'drop policies']
  ]){
   // A committed mutation is visible to the separate command; save definitions
   // and restore via the trusted reference database by reversing each mutation.
   const policies=(await c.query("select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='quantos' and tablename='tenants'")).rows;
   await c.query(sql);gate('live-rls',pattern);gate('schema-diff',/SCHEMA_DRIFT/);
   if(label==='disable RLS')await c.query('alter table quantos.tenants enable row level security');
   else if(label==='remove FORCE')await c.query('alter table quantos.tenants force row level security');
   else for(const p of policies)await c.query(`create policy "${p.policyname}" on quantos.tenants for ${p.cmd} to ${(Array.isArray(p.roles)?p.roles: p.roles.replace(/[{}]/g,'').split(',')).join(',')} ${p.qual?'using ('+p.qual+')':''} ${p.with_check?'with check ('+p.with_check+')':''}`);
   gate('schema-diff');receipt.checks.push(`reject ${label}`);
  }
  await c.query('alter table quantos.tenants add column f02_drift text');gate('schema-diff',/SCHEMA_DRIFT/);await c.query('alter table quantos.tenants drop column f02_drift');
  await c.query('create index f02_drift on quantos.tenants(name)');gate('schema-diff',/SCHEMA_DRIFT/);await c.query('drop index quantos.f02_drift');
  await c.query("update quantos.schema_migrations set sha256=repeat('0',64) where filename=(select min(filename) from quantos.schema_migrations)");gate('schema-diff',/MIGRATION_CHECKSUM/);
  const file=fs.readdirSync(path.join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()[0];
  await c.query('update quantos.schema_migrations set sha256=$1 where filename=$2',[crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'supabase/migrations',file))).digest('hex'),file]);
  receipt.checks.push('reject column/index drift and changed applied SQL checksum');
  const ids=Array.from({length:4},()=>crypto.randomUUID());
  await c.query('insert into auth.users(id) values($1),($2)',ids.slice(0,2));
  await c.query("insert into quantos.tenants(id,slug,name) values($1,'f02-a','A'),($2,'f02-b','B')",ids.slice(2));
  await c.query("insert into quantos.tenant_memberships(tenant_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner')",[ids[2],ids[0],ids[3],ids[1]]);
  for(const [user,visible] of [[ids[0],ids[2]],[ids[1],ids[3]]]){
   await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
   const rows=(await c.query('select id from quantos.tenants')).rows;
   if(rows.length!==1||rows[0].id!==visible)throw Error('Cross-tenant visibility');
   try{await c.query("insert into quantos.tenants(slug,name) values('forbidden','forbidden')");throw Error('Authenticated write was allowed');}catch(e){if(e.code!=='42501')throw e;}finally{await c.query('rollback');}
  }
  await c.query('begin');await c.query('set local role anon');if((await c.query('select * from quantos.tenants')).rowCount)throw Error('Anonymous visibility');await c.query('rollback');
  receipt.checks.push('two-user/two-tenant read isolation, authenticated writes denied, anonymous reads denied');
  gate('schema-diff');receipt.status='PASS';receipt.passed=true;
 }finally{
  for(const c of clients)await c.end();
  for(const n of names)await admin.query(`drop database if exists ${n} with (force)`);
  await admin.end();
 }
}
main().catch(e=>{receipt.status='FAIL';receipt.error=e.message;process.exitCode=1;console.error(e.message)}).finally(()=>{receipt.completedAt=new Date().toISOString();save();console.log(JSON.stringify(receipt,null,2))});
