import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyPublished} from './provider-all-functional-gate.mjs';
export function check({requireReady=true}={}){return verifyPublished({requireReady});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(process.argv.length===3&&['--ready','--engineering'].includes(process.argv[2]));console.log(JSON.stringify(check({requireReady:process.argv[2]==='--ready'}),null,2));}catch(e){console.error(e.message.split('\n')[0]);process.exitCode=2;}}
