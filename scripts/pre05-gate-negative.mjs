import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { scanClientArtifacts } from './check-client-secrets.mjs';
const root = resolve(import.meta.dirname, '..');
function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'pre05-client-test-'));
  try { return run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const tokens = [
  'gh'+'p_'+'A'.repeat(36), 'github_'+'pat_'+'A'.repeat(40), 'AK'+'IA'+'A'.repeat(16),
  'sk-'+'A'.repeat(24), 'sbp_'+'A'.repeat(24), 'sb_'+'secret_'+'A'.repeat(24),
  'eyJ'+'A'.repeat(20)+'.'+'A'.repeat(24)+'.'+'A'.repeat(24),
  '-----BEGIN '+'PRIVATE KEY-----',
];
test('public client ID and public Sentry DSN pass client scan', () => fixture(dir => {
  writeFileSync(join(dir,'index.html'),'quantos-terminal-local https://public@o0.ingest.sentry.io/1');
  assert.equal(scanClientArtifacts([dir], {}).status,'PASS');
}));
test('known secret shapes are rejected in every supported client artifact type', () => fixture(dir => {
  for (const extension of ['js','html','map','css','json','txt','svg','mjs']) for (const token of tokens) {
    const path = join(dir,`probe.${extension}`);writeFileSync(path,token);
    assert.equal(scanClientArtifacts([dir],{}).status,'FAIL');rmSync(path);
  }
}));
test('arbitrary injected server credentials and encoded forms are rejected', () => fixture(dir => {
  const secret = 'synthetic-private-value/with space';
  for (const value of [secret,JSON.stringify(secret).slice(1,-1),encodeURIComponent(secret)]) {
    writeFileSync(join(dir,'probe.js'),value);
    assert.equal(scanClientArtifacts([dir],{PRE05_SERVER_SECRET:secret}).status,'FAIL');
  }
}));
test('scanner rejects missing, empty and file roots', () => fixture(dir => {
  assert.throws(()=>scanClientArtifacts([]));assert.throws(()=>scanClientArtifacts([dir]));
  writeFileSync(join(dir,'probe.js'),'safe');assert.throws(()=>scanClientArtifacts([join(dir,'probe.js')]));
  assert.throws(()=>scanClientArtifacts([join(dir,'missing')]));
}));
test('scanner does not follow symlink artifacts', () => fixture(dir => {
  writeFileSync(join(dir,'safe.js'),'safe');symlinkSync(join(dir,'safe.js'),join(dir,'linked.js'));
  assert.throws(()=>scanClientArtifacts([dir]));
}));
test('artifact CLI fails closed and never echoes the synthetic secret', () => fixture(dir => {
  writeFileSync(join(dir,'probe.js'),tokens[0]);
  const result=spawnSync(process.execPath,[join(root,'scripts/check-client-secrets.mjs'),dir],{encoding:'utf8',env:{}});
  assert.equal(result.status,1);assert(!result.stderr.includes(tokens[0]));assert(result.stderr.includes('GitHub token'));
}));
test('relative and absolute env-file paths both work, missing paths fail', () => {
  const cli=join(root,'packages/config/scripts/check-env.mjs');
  for (const path of ['env/local-mock.env.example',join(root,'env/local-mock.env.example')]) {
    assert.match(execFileSync(process.execPath,[cli,path],{cwd:root,encoding:'utf8',env:{}}),/全部通过/);
  }
  assert.equal(spawnSync(process.execPath,[cli,'env/missing.env'],{cwd:root,env:{}}).status,1);
});
test('both actual application build commands enforce the client artifact gate', () => {
  for (const app of ['website','terminal']) {
    const script=JSON.parse(readFileSync(join(root,`apps/${app}/package.json`),'utf8')).scripts.build;
    assert(script.endsWith('&& node ../../scripts/check-client-secrets.mjs out'));
  }
  assert(readFileSync(join(root,'.github/workflows/frontend-baseline.yml'),'utf8').includes('run: pnpm check:client-secrets'));
});
