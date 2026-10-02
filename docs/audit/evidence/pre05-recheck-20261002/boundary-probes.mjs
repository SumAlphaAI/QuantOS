import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateEnv } from '../../../../packages/config/src/env.ts';
import { parseEnvText } from '../../../../packages/config/src/env-file.ts';
import { scanClientArtifacts } from '../../../../scripts/check-client-secrets.mjs';
const root=resolve(import.meta.dirname,'../../../..');
const dir=mkdtempSync(join(tmpdir(),'pre05-boundary-'));
try {
 const vars=parseEnvText(readFileSync(join(root,'env/local-mock.env.example'),'utf8'));
 const short='q7x4z2';
 const input=validateEnv({...vars,SERVER_SECRET:short,NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID:short});
 mkdirSync(join(dir,'out'));writeFileSync(join(dir,'out/probe.js'),short);
 const artifact=scanClientArtifacts([join(dir,'out')],{SERVER_SECRET:short});
 const fileSecret='synthetic-file-only-credential-2026';
 writeFileSync(join(dir,'.env.local'),`SERVER_SECRET=${fileSecret}\n`);
 writeFileSync(join(dir,'out/probe.js'),fileSecret);
 const cli=spawnSync(process.execPath,[join(root,'scripts/check-client-secrets.mjs'),join(dir,'out')],{env:{},encoding:'utf8'});
 console.log(JSON.stringify({shortSecretInputRejected:!input.ok,shortSecretArtifactRejected:artifact.status==='FAIL',envFileSecretArtifactRejected:cli.status===1,diagnosticsDoNotEchoSecret:!cli.stderr.includes(fileSecret)},null,2));
} finally {rmSync(dir,{recursive:true,force:true});}
