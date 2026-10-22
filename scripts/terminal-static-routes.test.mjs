import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {terminalStaticDocument} from './terminal-static-routes.mjs';
const manifest=JSON.parse(readFileSync('apps/terminal/public/terminal-route-map.json'));
const id='aaaaaaaa-1111-4111-8111-111111111111';
test('declared UUID resource routes resolve to actual exported documents',()=>{assert.equal(terminalStaticDocument('/data-snapshots/'+id,manifest),'data-snapshots.html');assert.equal(terminalStaticDocument('/audit/'+id,manifest),'audit.html');assert.equal(terminalStaticDocument('/exports/'+id,manifest),'exports.html');});
for(const path of ['/audit/nope','/audit/','/audit/'+id+'/extra','/audit/%2e%2e','/exports/'+id+'?x','/other/'+id,'/audit/'+id+'/../../.env'])test('no generic SPA fallback for '+path,()=>assert.equal(terminalStaticDocument(path,manifest),undefined));
test('website and undeclared maps cannot gain terminal resource routes',()=>{assert.equal(terminalStaticDocument('/audit/'+id,undefined),undefined);assert.equal(terminalStaticDocument('/audit/'+id,{...manifest,schema:'other'}),undefined);assert.equal(terminalStaticDocument('/audit/'+id,{...manifest,routes:[{prefix:'audit',document:'../../private'}]}),undefined);});
