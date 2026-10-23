import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundary,validateBoundary,validateBrowser,validateAxeReport,checks,validateExecutions,planCheck,reuse,inputs} from './ui-p04-review.mjs';
import {hash} from './g1-download-review.mjs';
const sha='a'.repeat(40);
test('bounded current function receipt is accepted',()=>validateBoundary(boundary(sha)));
for(const[k,v]of Object.entries(boundary(sha)).filter(([k])=>k!=='sourceCommit'))test('refuse changed boundary '+k,()=>assert.throws(()=>validateBoundary({...boundary(sha),[k]:typeof v==='boolean'?!v:'INVALID_PROMOTION'})));
test('source must be a complete SHA',()=>assert.throws(()=>validateBoundary(boundary('short'))));
const report=()=>({errors:[],stats:{expected:14,unexpected:0,skipped:0,flaky:0},suites:[{specs:Array.from({length:14},()=>({tests:[{projectName:'chromium',results:[{status:'passed'}]}]}))}]});
test('all fourteen browser scenarios must pass once',()=>validateBrowser(report()));
for(const[name,change]of [['skipped',r=>r.stats.skipped=1],['unexpected',r=>r.stats.unexpected=1],['flaky',r=>r.stats.flaky=1],['errors',r=>r.errors.push('error')],['retry',r=>r.suites[0].specs[0].tests[0].results.push({status:'passed'})],['failed',r=>r.suites[0].specs[0].tests[0].results[0].status='failed'],['project',r=>r.suites[0].specs[0].tests[0].projectName='firefox']])test('refuse browser '+name,()=>{const r=report();change(r);assert.throws(()=>validateBrowser(r));});
const rows=()=>checks.map(c=>({id:c.id,command:c.command.map(v=>v.replaceAll('{attempt}','attempt')),expectedExitCode:c.exit,exitCode:c.exit,signal:null,errorCode:null,log:'AGENTS.md',logSha256:hash(readFileSync('AGENTS.md'))}));
test('execution command, exit and log hashes match exact bounded checks',()=>validateExecutions(rows(),'attempt'));
for(const[name,change]of [['missing',r=>r.pop()],['swapped',r=>[r[0],r[1]]=[r[1],r[0]]],['command',r=>r[1].command.push('--skip')],['exit',r=>r[0].exitCode=1],['signal',r=>r[0].signal='SIGTERM'],['error',r=>r[0].errorCode='TIMEOUT'],['hash',r=>r[0].logSha256='sha256:'+'0'.repeat(64)]])test('refuse execution '+name,()=>{const r=rows();change(r);assert.throws(()=>validateExecutions(r,'attempt'));});
test('all stage gates unchanged; only UI_P04 pending current function',()=>assert.equal(planCheck(),159));
test('prior source, binary and all 6+2+12 incomplete scans retain original binding',()=>{const r=reuse();assert.equal(r.originalInputs,593);assert.equal(r.binaryReuse.unchangedRustInputs,245);assert.equal(r.binaryReuse.rebuilt,false);assert.equal(r.originalTests.reexecuted,false);const count=rows=>rows.reduce((n,a)=>n+a.scans.reduce((n,s)=>n+s.incomplete,0),0);assert.equal(count(r.retainedAxe.originalIcons),6);assert.equal(count(r.retainedAxe.currentHeaders),2);assert.equal(count(r.retainedAxe.currentPage),12);assert.equal(count(r.retainedAxe.currentUI203),0);});

test("Artifact source is included in frozen inputs despite generic generated-artifacts ignore",()=>{const paths=inputs().map(f=>f.path);for(const path of [".gitignore","apps/terminal/app/artifacts/page.tsx","apps/terminal/app/artifacts/workspace.tsx","apps/terminal/app/artifacts/workspace.css","apps/terminal/src/artifacts/runtime.ts","apps/terminal/src/artifacts/policy.ts"])assert(paths.includes(path));});

const axe=()=>({sourceCommit:sha,theme:'dark',priorIncomplete:{icons:6,headers:2,p03:12},manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN',crossOsVisual:'NOT_RUN',scans:['research','artifact'].flatMap(kind=>[1672,1024,390].map(width=>({kind,width,violations:[],incomplete:[{id:'color-contrast',nodes:[{target:['.nav-icon']}]}]})))});
test('all twelve current scans are typed and retain incomplete findings without promoting them',()=>validateAxeReport(axe(),sha));
for(const[name,change]of [['missing scan',a=>a.scans.pop()],['wrong width',a=>a.scans[0].width=1440],['wrong page',a=>a.scans[0].kind='unknown'],['wrong candidate',a=>a.sourceCommit='b'.repeat(40)],['violation',a=>a.scans[0].violations.push({id:'contrast'})],['unresolved semantic issue',a=>a.scans[0].incomplete[0].id='aria-prohibited-attr'],['unrecorded finding nodes',a=>a.scans[0].incomplete[0].nodes=[]],['historical contrast closed',a=>a.priorIncomplete.icons=0],['manual test invented',a=>a.manualScreenReader='PASS']])test('refuse axe '+name,()=>{const a=axe();change(a);assert.throws(()=>validateAxeReport(a,sha));});
