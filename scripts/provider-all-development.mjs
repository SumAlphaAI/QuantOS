import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyPublished} from './provider-all-functional-gate.mjs';
export function check({requireReady=true}={}){if(nodesFromPlans().get('PROVIDER:ALL').stage_gate.evidence[0]?.match(/^audit\/evidence\/g0-(?:legacy-)?local-/)){try{return JSON.parse(execFileSync(process.execPath,[resolve(nodesFromPlans().get('PROVIDER:ALL').stage_gate.evidence[0]?.startsWith('audit/evidence/g0-legacy-local-')?'scripts/g0-legacy-functional-gate.mjs':'scripts/g0-current-functional-gate.mjs'),requireReady?'--all-ready':'--all-engineering'],{encoding:'utf8',maxBuffer:8*1024*1024}));}catch(e){throw Error(e.stderr?.toString().trim()||e.message);}}return verifyPublished({requireReady});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(process.argv.length===3&&['--ready','--engineering'].includes(process.argv[2]));console.log(JSON.stringify(check({requireReady:process.argv[2]==='--ready'}),null,2));}catch(e){console.error(e.message.split('\n')[0]);process.exitCode=2;}}
