import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFixture } from './validate.mjs';
const directory=dirname(fileURLToPath(import.meta.url));
export function validateFixtureInventory(root=directory) {
  const manifest=JSON.parse(readFileSync(join(root,'fixture-manifest.json'),'utf8'));
  const issues=[];const actual=[];
  function visit(path,prefix='') {
    for(const entry of readdirSync(path,{withFileTypes:true})) {
      const name=prefix+entry.name;
      if(entry.isDirectory())visit(join(path,entry.name),name+'/');
      else if(entry.isFile()&&name.endsWith('.json'))actual.push(name);
      else issues.push('unsupported fixture entry: '+name);
    }
  }
  visit(join(root,'fixtures'));
  const entries=manifest.entries??[];const declared=entries.map(e=>e.path);
  if(manifest.schema!=='quantos-contract-fixtures/v1'||!entries.length)issues.push('invalid fixture manifest');
  if(new Set(declared).size!==declared.length)issues.push('duplicate fixture');
  if(JSON.stringify(actual.sort())!==JSON.stringify([...declared].sort()))issues.push('fixture inventory mismatch');
  for(const entry of entries) {
    if((entry.scope==='inventory-only')!==entry.schema?.startsWith('PRE04')||!['contract','inventory-only'].includes(entry.scope)||!entry.purpose||!entry.schema||!['PASS','FAIL'].includes(entry.expect)||entry.path.includes('..')){issues.push('invalid fixture entry');continue;}
    try {
      const value=JSON.parse(readFileSync(join(root,'fixtures',entry.path),'utf8'));
      const errors=validateFixture(value,{schema:entry.schema});
      if(entry.expect==='PASS'&&errors.length)issues.push('invalid positive fixture: '+entry.path);
      if(entry.expect==='FAIL'&&(!entry.issue||!errors.some(error=>error.includes(entry.issue))))issues.push('negative fixture no longer rejected: '+entry.path);
    } catch {issues.push('unreadable fixture/schema: '+entry.path);}
  }
  return {status:issues.length?'FAIL':'PASS',entries:entries.length,issues};
}
export function loadValidatedFixture(path) {
  const manifest=JSON.parse(readFileSync(join(directory,'fixture-manifest.json'),'utf8'));
  const entry=manifest.entries.find(e=>e.path===path&&e.expect==='PASS'&&e.scope==='contract'&&!e.schema.startsWith('PRE04'));
  if(!entry)throw new Error('Unknown positive fixture');
  const value=JSON.parse(readFileSync(join(directory,'fixtures',path),'utf8'));
  if(validateFixture(value,{schema:entry.schema}).length)throw new Error('Invalid positive fixture: '+path);
  return value;
}
