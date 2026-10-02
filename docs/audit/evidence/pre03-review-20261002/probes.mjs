import {loadRuntimeInputs,validateRuntimeContract,runPre03} from '../../../../scripts/pre03-smoke.mjs';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
const root=resolve('.'); const current=loadRuntimeInputs(root,{webOnly:true}); const results=[];
const check=(id,input)=>{const r=validateRuntimeContract(input,{webOnly:true});results.push({id,expected:'FAIL',actual:r.status,failures:r.failures});};
results.push({id:'current-web-contract',...validateRuntimeContract(current,{webOnly:true})});
check('comment-only-export',{...current,terminalNextConfig:'// output: "export"\nexport default {output: "standalone"};',websiteNextConfig:'// output: "export"\nexport default {output: "standalone"};'});
check('overridden-export',{...current,terminalNextConfig:'const config = {output: "export"}; config.output = "standalone"; export default config;'});
check('missing-package-resolution',{...current,pnpmLock:{...structuredClone(current.pnpmLock),packages:{},snapshots:{}}});
check('web-only-rust-drift',{...current,rustToolchain:'[toolchain]\nchannel = "0.0.0"'});
const tmp=mkdtempSync('/private/tmp/quantos-pre03-probe-');
try {
 for(const f of ['package.json','.nvmrc','rust-toolchain.toml','pnpm-lock.yaml','apps/terminal/next.config.ts','apps/website/next.config.ts']){mkdirSync(dirname(join(tmp,f)),{recursive:true});copyFileSync(join(root,f),join(tmp,f));}
 for(const app of ['terminal','website']){const path=join(tmp,'apps',app);mkdirSync(join(path,'out'),{recursive:true});copyFileSync(join(root,'apps',app,'package.json'),join(path,'package.json'));}
 let pkg=JSON.parse(readFileSync(join(tmp,'apps/terminal/package.json'),'utf8')); pkg.dependencies.next='16.0.0';writeFileSync(join(tmp,'apps/terminal/package.json'),JSON.stringify(pkg));
 results.push({id:'package-manifest-drift',expected:'FAIL',actual:validateRuntimeContract(loadRuntimeInputs(tmp,{webOnly:true}),{webOnly:true}).status});
 writeFileSync(join(tmp,'apps/terminal/out/command.html'),'<html><script src="/_next/static/chunks/app/command-MISSING.js"></script></html>');
 writeFileSync(join(tmp,'apps/website/out/index.html'),'<html><div data-smoke="website-home"></div><script src="/_next/MISSING.js"></script></html>');
 const fake=await runPre03(tmp,{webOnly:true});results.push({id:'empty-page-missing-chunks',expected:'FAIL',actual:fake.status,built_route_checks:fake.built_route_checks,failures:fake.failures});
 rmSync(join(tmp,'apps/terminal/out/command.html')); const missing=await runPre03(tmp,{webOnly:true});results.push({id:'missing-route',expected:'FAIL',actual:missing.status,failures:missing.failures});
} finally {rmSync(tmp,{recursive:true,force:true});}
console.log(JSON.stringify(results,null,2));
