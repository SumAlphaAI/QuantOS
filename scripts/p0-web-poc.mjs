// Build only the two P0 Web apps and design-system PoC, with public synthetic config.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {root,digest,inventory} from './provider-a1-receipts.mjs';
import {environment} from './p0-functional-scope.mjs';
const env=environment(),start=Date.now();
assert.equal(execFileSync('pnpm',['--version'],{env,encoding:'utf8'}).trim(),'10.20.0');
assert.equal(process.versions.node,'24.12.0');
for(const app of ['terminal','website'])for(const file of ['.env','.env.local','.env.production','.env.production.local'])assert(!existsSync(root+`/apps/${app}/${file}`),'private app dotenv is not allowed in P0 mock PoC');
function run(args){execFileSync('pnpm',args,{cwd:root,env,stdio:'inherit',timeout:600000});}
for(const app of ['website','terminal'])run(['--filter',`@sumalpha/${app}`,'build']);
run(['--filter','@sumalpha/ui','build-storybook']);
run(['check:pre03:web']);
// Existing full page campaigns remain in INTEGRATION. Exercise only preparation PoCs.
run(['exec','playwright','test','tests/e2e/command.spec.ts','tests/e2e/auth-callback.spec.ts','--project=chromium','--workers=1','--retries=0','--update-snapshots=none','--reporter=list']);
run(['exec','playwright','test','--config','playwright.website.config.ts','--project=chromium','--workers=1','--retries=0','--grep','首页呈现|无障碍违规','--reporter=list']);
run(['check:client-secrets']);
const builds=Object.fromEntries(['website','terminal'].map(app=>[app,JSON.parse(readFileSync(root+`/apps/${app}/out/pre03-build.json`))]));
assert(Date.now()-start<30*60*1000,'P0 local existing-dependency build/PoC exceeded thirty minutes');
console.log('P0_WEB_POC='+JSON.stringify({schema:'quantos-p0-web-poc/v1',status:'PASS',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),builds,elapsedMs:Date.now()-start,bootstrap:'NOT_RUN_EXISTING_LOCKED_DEPENDENCIES',browsers:['chromium'],storybook:'BUILT',externalPublished:false,clientSecrets:'PASS',outputScope:'LOCAL_EPHEMERAL',sourceInventoryDigest:digest(JSON.stringify(inventory(['apps/terminal/','apps/website/','packages/'])))}));
