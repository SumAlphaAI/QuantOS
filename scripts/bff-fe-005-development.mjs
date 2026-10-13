import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {verifyPublished} from './research-local-gate.mjs';
export {operations,validateMarketRecords,validateMarketEvidence} from './bff-fe-005-evidence.mjs';

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const r=verifyPublished('BFF005_LOCAL');console.log(JSON.stringify({...r,operations:7},null,2));}catch(e){console.error(e.message.split('\n')[0]);process.exitCode=2;}}
