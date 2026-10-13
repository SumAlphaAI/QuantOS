import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyRelease} from './verify-release.mjs';
import {expectedCiSourceSha} from './f02-source-sha.mjs';
const sha=expectedCiSourceSha();
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.GITHUB_RUN_ID)throw Error('Remote receipt requires GitHub Actions context');
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha)throw Error('F02 receipt checkout does not match source SHA');
verifyRelease('artifacts/release',sha);
// Component CI never promotes a build. Protected signing is a separate manual
// candidate + successful source-run operation, with its own promotion receipt.
fs.mkdirSync('artifacts/f02',{recursive:true});
fs.writeFileSync('artifacts/f02/download-receipt.json',JSON.stringify({status:'PASS',commit:sha,run:`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,attempt:process.env.GITHUB_RUN_ATTEMPT,artifact:process.env.QUANTOS_DOWNLOADED_ARTIFACT||'quantos-build-inputs',downloadVerified:true,formalSignatureVerified:false,completedAt:new Date().toISOString()},null,2)+'\n');
