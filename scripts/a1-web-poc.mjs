import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {loadRuntimeInputs,validateRuntimeContract,checkPage} from './pre03-smoke.mjs';
import {sourceDigest} from './pre03-build-receipt.mjs';
import {root} from './provider-a1-receipts.mjs';
import {webEnvironment} from './a1-functional-scope.mjs';
const env=webEnvironment();for(const f of ['.env','.env.local','.env.production','.env.production.local'])assert(!existsSync(root+'/apps/terminal/'+f),'private app dotenv denied');
function run(args){execFileSync('pnpm',args,{env,cwd:root,stdio:'inherit',timeout:600000});}
run(['--filter','@sumalpha/terminal','build']);const contract=validateRuntimeContract(await loadRuntimeInputs(root));assert.equal(contract.status,'PASS');
const build=JSON.parse(readFileSync(root+'/apps/terminal/out/pre03-build.json'));assert.equal(build.sourceDigest,sourceDigest(root,env));
const browser=await chromium.launch({headless:true});try{const page=await checkPage(root,{name:'terminal-web',directory:'apps/terminal/out',path:'/command',marker:'static/chunks/app/command',selector:'[data-smoke="route-/command"]',browser});assert(page.ok,page.message);}finally{await browser.close();}
run(['exec','playwright','test','tests/e2e/command.spec.ts','tests/e2e/auth-callback.spec.ts','--project=chromium','--workers=1','--retries=0','--update-snapshots=none','--reporter=list']);
execFileSync(process.execPath,['scripts/check-client-secrets.mjs','apps/terminal/out'],{env,cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['scripts/check-perf-budget.mjs','apps/terminal/out'],{env,cwd:root,stdio:'inherit'});
console.log('A1_WEB_POC='+JSON.stringify({status:'PASS',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),build,webRoute:'PASS',oidc:'MOCK_ROUTE_INTERCEPTED',browser:'chromium',cases:11,staticBudget:'PASS',performanceAcceptance:'NOT_RUN',publicOrigins:{terminal:env.NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN,callback:env.NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI},privateDotenv:'ABSENT',runtimeChecks:contract.runtime_contract_checks}));
