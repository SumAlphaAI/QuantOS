import fs from 'node:fs';
import path from 'node:path';
const root=process.env.QUANTOS_GATE_ROOT ?? process.cwd();
const directory=path.join(root,'supabase/migrations');
const tables=new Map();
// Strip comments, literals and function bodies before matching DDL. This is a
// preflight only; f02-db-check executes all migrations and inspects the catalog.
const scrub = sql => sql.replace(/\$([\w]*)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\//g,' ');
const identifier='(?:"[^"]+"|[a-z_][a-z_0-9]*)';
for(const name of fs.readdirSync(directory).filter(x=>x.endsWith('.sql')).sort()) {
 const sql=scrub(fs.readFileSync(path.join(directory,name),'utf8'));
 for(const statement of sql.split(';')) {
  let m;
  if((m=/\bcreate\s+table\s+(?:if not exists\s+)?(quantos\.\w+)/i.exec(statement))) {
   if(m[1].toLowerCase()!=='quantos.schema_migrations') tables.set(m[1].toLowerCase(),{enabled:false,force:false,policies:new Set()});
  }
  if((m=/\balter\s+table\s+(?:only\s+)?(quantos\.\w+)\s+(enable|disable|force|no\s+force)\s+row\s+level\s+security/i.exec(statement))) {
   const table=tables.get(m[1].toLowerCase()); if(!table)continue;
   const operation=m[2].toLowerCase(); if(['enable','disable'].includes(operation))table.enabled=operation==='enable'; else table.force=operation==='force';
  }
  if((m=new RegExp(`\\b(create|drop)\\s+policy\\s+(?:if exists\\s+)?(${identifier})\\s+on\\s+(quantos\\.\\w+)`,'i').exec(statement))) {
   const table=tables.get(m[3].toLowerCase()); if(!table)continue;
   const policy=m[2].replaceAll('"','').toLowerCase(); if(m[1].toLowerCase()==='create')table.policies.add(policy);else table.policies.delete(policy);
  }
 }
}
if(!tables.size)throw new Error('No quantos tables found');
for(const [name,t] of tables)if(!t.enabled||!t.force||!t.policies.size)throw new Error(`RLS_BASELINE: ${name} requires final ENABLE, FORCE and CREATE POLICY`);
console.log(`RLS static preflight passed for ${tables.size} tables; database execution is separately mandatory.`);
