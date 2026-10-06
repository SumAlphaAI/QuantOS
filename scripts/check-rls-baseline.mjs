import fs from 'node:fs';
import path from 'node:path';
const root=process.env.QUANTOS_GATE_ROOT ?? process.cwd();
const directory=path.join(root,'supabase/migrations');
const tables=new Map();
const identifier='(?:"[^"]+"|[a-z_][a-z_0-9]*)';
// Expand only the unconditional literal FOREACH/format form used by A2. Other
// executable DO blocks containing RLS DDL fail closed. Function bodies, quoted
// examples and comments remain opaque. This preflight does not execute SQL;
// f02-db-check separately applies migrations and inspects PostgreSQL's catalog.
function expandRlsLoop(body) {
 const text=body.replace(/'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\//g,t=>t.startsWith("'")?t:' ');
 if(!/row\s+level\s+security|\b(?:create|drop)\s+policy\b/i.test(text))return ' ';
 const loop=/^\s*declare\s+([a-z_][a-z_0-9]*)\s+text\s*;\s*begin\s+foreach\s+\1\s+in\s+array\s+array\s*\[([^\]]*)\]\s+loop\s+([\s\S]*?)\s*end\s+loop\s*;\s*end\s*;?\s*$/i.exec(text);
 const reject=()=>{throw new Error('RLS_BASELINE: unsupported dynamic RLS block; require unconditional literal FOREACH/format DDL');};
 if(!loop||!/^\s*'[a-z_][a-z_0-9]*'\s*(?:,\s*'[a-z_][a-z_0-9]*'\s*)*$/.test(loop[2]))return reject();
 const names=[...loop[2].matchAll(/'([a-z_][a-z_0-9]*)'/g)].map(m=>m[1]);
 if(new Set(names).size!==names.length)return reject();
 const command=new RegExp(`\\s*execute\\s+format\\s*\\(\\s*'((?:''|[^'])*)'\\s*,\\s*${loop[1]}\\s*\\)\\s*;\\s*`,'iy');
 const templates=[];let offset=0;
 while(offset<loop[3].length) {
  command.lastIndex=offset;const match=command.exec(loop[3]);if(!match)return reject();offset=command.lastIndex;
  const ddl=match[1].replaceAll("''", "'");
  const alter=/^alter\s+table\s+quantos\.%I\s+(?:enable|disable|force|no\s+force)\s+row\s+level\s+security$/i.test(ddl);
  const policy=new RegExp(`^(?:create|drop)\\s+policy\\s+(?:if\\s+exists\\s+)?${identifier}\\s+on\\s+quantos\\.%I(?:\\s|$)`,'i').test(ddl);
  // Permissions in the same literal loop do not establish RLS, but are safe
  // to expand when their table and roles are literal and tightly constrained.
  const privilege=/^(?:revoke\s+all\s+on\s+quantos\.%I\s+from\s+anon\s*,\s*authenticated|grant\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+quantos\.%I\s+to\s+quantos_bff)$/i.test(ddl);
  if((!alter&&!policy&&!privilege)||ddl.replace('%I','').includes('%'))return reject();templates.push(ddl);
 }
 if(!templates.length)return reject();
 return names.flatMap(name=>templates.map(ddl=>ddl.replace('%I',name))).join(';\n')+';';
}
function scrub(sql) {
 const tokens=/\$([\w]*)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\//g;
 let clean='',offset=0;
 for(const match of sql.matchAll(tokens)) {
  clean+=sql.slice(offset,match.index);offset=match.index+match[0].length;
  if(match[0].startsWith('$')&&/\bdo\s*$/i.test(clean)) {
   const delimiter=match[1].length+2;clean=clean.replace(/\bdo\s*$/i,'')+scrub(expandRlsLoop(match[0].slice(delimiter,-delimiter)));
  }else clean+=' ';
 }
 return clean+sql.slice(offset);
}
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
