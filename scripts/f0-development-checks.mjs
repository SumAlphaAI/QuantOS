import assert from 'node:assert/strict';
import {readFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {root} from './provider-a1-receipts.mjs';
const require=createRequire(import.meta.url);
function run(command,args){const r=spawnSync(command,args,{cwd:root,env:process.env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024});process.stdout.write((r.stdout??'')+(r.stderr??''));assert.equal(r.status,0,`${command} failed`);}
async function database(){
 const {runDatabase}=require('./lib/f02-development-database.cjs');
 await runDatabase({root,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()});
}

function capability(){
 const text=readFileSync(resolve(root,'docs/operations/tp01_vibe_inventory_and_threats.md'),'utf8');const rows=text.split('\n').filter(l=>l.startsWith('| ')&&!l.startsWith('| ---')&&!l.startsWith('| Capability')&&!l.startsWith('| Threat')).slice(0,11);
 assert.equal(rows.length,11);for(const row of rows){const cells=row.split('|').slice(1,-1).map(s=>s.trim());assert.equal(cells.length,8);assert(cells.every(Boolean),'capability input/output/side effect/permission/replacement missing');}
 for(const label of ['Trading connectors','Persistent memory','Channels / IM surfaces']){const row=rows.find(r=>r.includes(label));assert(row&&/forbidden|reject|deny/.test(row),'sensitive capability must be denied');}
 const boundary=readFileSync(resolve(root,'docs/adr/20260730-tp01-vibe-boundaries.md'),'utf8');for(const term of ['Trading connectors','Secret persistence','Filesystem','Shell','Network'])assert(text.toLowerCase().includes(term.split(' ')[0].toLowerCase())||boundary.toLowerCase().includes(term.toLowerCase()));
 console.log('TP01-B 11 complete capabilities and forbidden trading/secret/storage coupling PASS');
}
function engine(){
 rmSync(resolve(root,'artifacts/f08-target/wheels'),{recursive:true,force:true});
 run('uv',['build','engines/mock-engine','--wheel','--out-dir','artifacts/f08-target/wheels']);
 run('uv',['sync','--locked','--project','engines','--all-packages','--no-editable']);
 try{run(process.execPath,['scripts/f08-target-service-acceptance.mjs']);}
 finally{run('uv',['sync','--locked','--project','engines','--all-packages']);}
}
function repository(){
 const lock=JSON.parse(readFileSync(resolve(root,'forks/vibe-trading/repository.lock.json')));const owner=new URL(lock.fork.url).pathname.split('/')[1];
 // Read the existing authenticated owner account without changing gh's active account.
 const token=execFileSync('gh',['auth','token','--hostname','github.com','--user',owner],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();assert(token,'authenticated fork owner required');process.env.TP01_FORK_ADMIN_TOKEN=token;
 run('make',['-e','tp01-vibe-repository-check']);
}
try{const mode=process.argv[2];assert.equal(process.argv.length,3);if(mode==='--database')await database();else if(mode==='--capability')capability();else if(mode==='--engine')engine();else if(mode==='--repository')repository();else assert.fail('unknown F0 check mode');}catch(error){console.error(error.message);process.exitCode=1;}
