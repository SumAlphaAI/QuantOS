import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyPublished} from './research-local-gate.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
export {operations,validateMarketRecords,validateMarketEvidence} from './bff-fe-005-evidence.mjs';
export function check(){const g=nodesFromPlans().get('FE:BFF-FE-005').stage_gate;if(g.status==='READY'&&g.evidence[0]?.startsWith('audit/evidence/bff-fe-005-local-'))return JSON.parse(execFileSync(process.execPath,[resolve('scripts/bff-fe-005-functional-gate.mjs'),'--ready'],{encoding:'utf8',maxBuffer:8*1024*1024}));return {...verifyPublished('BFF005_LOCAL'),operations:7};}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(process.argv.length===2||process.argv.length===3&&process.argv[2]==='--ready');console.log(JSON.stringify(check(),null,2));}catch(e){console.error(e.message.split('\n')[0]);process.exitCode=2;}}
