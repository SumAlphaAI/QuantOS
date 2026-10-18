// PRE03 clean workspace timing proof with the current cached/offline lock; no core closure.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {webEnvironment,cleanWebCommands} from './p0-functional-scope.mjs';
const root=resolve(import.meta.dirname,'..'),sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const workspace=mkdtempSync(join(tmpdir(),'quantos-p0-clean-web-')),start=Date.now();
const selectors=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','patches','.nvmrc','rust-toolchain.toml','tsconfig.base.json','eslint.config.mjs','playwright.config.ts','playwright.website.config.ts','vitest.critical.config.ts','apps/terminal','apps/website','packages','scripts','tests','env','docs/adr/20260814-pre03-runtime-stack.md'];
let completed=false;
try{
 const archive=execFileSync('git',['archive','--format=tar',sourceCommit,'--',...selectors],{cwd:root,maxBuffer:64*1024*1024});execFileSync('tar',['-xf','-','-C',workspace],{input:archive});
 assert(!existsSync(workspace+'/node_modules'));assert(!existsSync(workspace+'/.env.local'));
 const env={...webEnvironment(),GITHUB_SHA:sourceCommit,npm_config_userconfig:'/dev/null',PNPM_DISABLE_SELF_UPDATE_CHECK:'1'};
 const commands=cleanWebCommands;
 for(const args of commands){console.log('P0_CLEAN_COMMAND='+JSON.stringify(['pnpm',...args]));execFileSync('pnpm',args,{cwd:workspace,env,stdio:'inherit',timeout:600000});}
 const elapsedMs=Date.now()-start;assert(elapsedMs<1800000);
 console.log('P0_CLEAN_WEB='+JSON.stringify({schema:'quantos-p0-clean-web/v1',status:'PASS',sourceCommit,commands,elapsedMs,bootstrap:'FROZEN_OFFLINE_IGNORE_SCRIPTS',cache:'EXISTING_PNPM_STORE',initialNodeModules:'ABSENT',privateDotenv:'ABSENT',webRoutes:2,externalPublished:false,networkInstall:false,emptyDownloadCacheAcceptance:'NOT_CLAIMED'}));completed=true;
}finally{if(completed)rmSync(workspace,{recursive:true,force:true});else console.error('P0_CLEAN_WORKSPACE_RETAINED='+workspace);}
