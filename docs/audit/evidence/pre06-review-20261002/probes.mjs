import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadPre06Inputs, validatePre06 } from '../../../../scripts/check-pre06.mjs';
import { loadFixture, validateFixture } from '../../../../tests/contract/validate.mjs';
import { validateVisualBaselines } from '../../../../scripts/check-visual-baselines.mjs';
const root=resolve(import.meta.dirname,'../../../..');const current=loadPre06Inputs(root);const results=[];
function record(name,rejected,detail){results.push({name,expected:'REJECT',actual:rejected?'REJECT':'ACCEPT',matches:rejected,detail});}
for(const [name,command] of [['disabled-website-step','pnpm test:browser:website --project=chromium'],['disabled-terminal-step','pnpm exec playwright test --project=chromium'],['disabled-visual-integrity-step','pnpm check:visual-baselines']]) {
 const text=current.frontendWorkflowText.replace('run: '+command,'if: false\n        run: '+command);
 record(name,validatePre06({...current,frontendWorkflowText:text}).status==='FAIL','workflow step if:false; parsed YAML is not used to enforce execution');
}
const disabled=current.frontendWorkflowText.replaceAll('run:','run: echo disabled #');
record('all-frontend-commands-commented',validatePre06({...current,frontendWorkflowText:disabled}).status==='FAIL','required strings survive only as shell comments');
record('delete-sabotage-ci-step',validatePre06({...current,frontendWorkflowText:current.frontendWorkflowText.replace('run: node scripts/pre06-sabotage-check.mjs','run: echo removed')}).status==='FAIL','completion-standard sabotage command is not validated');
record('contract-test-markers-only',validatePre06({...current,contractTests:'// MOCK_NOT_CONFIGURED currentVersion retryAfter venueApiKey executable=true\n'}).status==='FAIL','only comments remain; gate accepts marker text without assertions');
const base=loadFixture('session/default.json');
for(const key of ['vault_path','signing_key','bearer_token','model_key']) {
 record('sensitive-alias-'+key,validateFixture({...base,[key]:'synthetic-private-marker'},{schema:'SessionContext'}).length>0,'canonical camelCase forbidden key alias; JSON schema permits extra property');
}
record('canonical-sensitive-field',validateFixture({...base,venueApiKey:'synthetic-private-marker'},{schema:'SessionContext'}).length>0,'positive rejection control');
record('schema-required-field',validateFixture(loadFixture('sabotage/schema-broken.json'),{schema:'SessionContext'}).length>0,'positive rejection control');
record('executable-permission',validateFixture({...loadFixture('proposal/default.json'),executable:true},{schema:'TradeProposal'}).length>0,'positive rejection control');
record('visual-required-linux',validateVisualBaselines(root,{platform:'linux'}).status==='FAIL','inventory completeness probe is separately positive; expected available platform PASS, not a fault');
results.pop();
const dir=mkdtempSync(join(tmpdir(),'pre06-perf-empty-'));
try {
 mkdirSync(join(dir,'out/_next'),{recursive:true});mkdirSync(join(dir,'.next'));
 writeFileSync(join(dir,'.next/app-build-manifest.json'),JSON.stringify({pages:{}}));
 const r=spawnSync(process.execPath,[join(root,'scripts/check-perf-budget.mjs'),join(dir,'out')],{encoding:'utf8',env:{}});
 record('empty-build-perf',r.status!==0,'empty pages/chunk/CSS inventory: '+r.stdout.trim().replaceAll('\n','; '));
} finally{rmSync(dir,{recursive:true,force:true});}
writeFileSync(new URL('probes.json',import.meta.url),JSON.stringify({results,unexpected_accepts:results.filter(x=>!x.matches).length},null,2)+'\n');console.log(JSON.stringify(results.map(({name,actual})=>({name,actual})),null,2));
