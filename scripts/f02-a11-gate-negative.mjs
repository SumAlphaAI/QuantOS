import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { parse } from 'yaml';
import { execFileSync, spawnSync } from 'node:child_process';
import { validateSigningPolicy } from './check-f02-signing-policy.mjs';
import { requiredVisualPaths, validateVisualBaselines } from './check-visual-baselines.mjs';

test('complete Linux matrix passes; deletion and pixel tampering fail', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f02-visual-'));
  try {
    const bytes = PNG.sync.write(new PNG({ width: 1440, height: 900 }));
    const entries = requiredVisualPaths('linux').map((relative) => {
      fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      fs.writeFileSync(path.join(root, relative), bytes);
      return { path: relative, sha256: createHash('sha256').update(bytes).digest('hex'), width: 1440, height: 900, scope: 'test fixture' };
    });
    const manifest = { schema: 'quantos-visual-baselines/v1', maxDiffPixelRatio: 0.005, entries };
    const manifestPath = path.join(root, 'tests/e2e/visual-baselines.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.equal(validateVisualBaselines(root, { platform: 'linux' }).status, 'PASS');
    const removed = manifest.entries.pop();
    fs.unlinkSync(path.join(root, removed.path));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert(validateVisualBaselines(root, { platform: 'linux' }).issues.includes(`missing required platform baseline: ${removed.path}`));
    manifest.entries.push(removed);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.writeFileSync(path.join(root, removed.path), bytes);
    const png = PNG.sync.read(bytes);
    png.data[0] = 255;
    fs.writeFileSync(path.join(root, removed.path), PNG.sync.write(png));
    assert(validateVisualBaselines(root, { platform: 'linux' }).issues.includes(`sha256 mismatch: ${removed.path}`));
    fs.writeFileSync(path.join(root, removed.path), bytes);
    assert.equal(validateVisualBaselines(root, { platform: 'linux' }).status, 'PASS');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('acceptance never updates snapshots or skips missing snapshots', () => {
  for (const name of ['ci', 'frontend-baseline', 'compatibility']) {
    const workflow = fs.readFileSync(`.github/workflows/${name}.yml`, 'utf8');
    assert(!workflow.includes('--update-snapshots'));
    assert(/(?:check-visual-baselines\.mjs|check:visual-baselines) --platform linux/.test(workflow));
    assert(workflow.includes('runs-on: ubuntu-24.04'));
  }
  for (const name of ['command', 'ui102-auth', 'ui104-settings']) {
    assert(!fs.readFileSync(`tests/e2e/${name}.spec.ts`, 'utf8').includes('testInfo.skip'));
  }
});

test('only main signing and verification jobs receive the signing environment', () => {
  const ci = parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
  for (const name of ['sign-main', 'verify-download-main']) {
    assert.equal(ci.jobs[name].environment, 'f02-signing');
    assert.equal(ci.jobs[name].if, "github.event_name == 'push' && github.ref == 'refs/heads/main'");
  }
  assert(ci.jobs['sign-main'].needs.includes('signing-policy'));
  assert.equal(ci.jobs['signing-policy'].permissions.actions, 'read');
  for (const name of ['verify', 'verify-download-pr']) {
    assert.equal(ci.jobs[name].environment, undefined);
    assert(!JSON.stringify(ci.jobs[name]).includes('secrets.QUANTOS_SIGNING_KEY'));
  }
  assert.equal(ci.jobs['verify-download'].if, 'always()');
  assert(ci.jobs['verify-download'].steps[0].run.includes('test "$MAIN_RESULT" = success'));
  assert(ci.jobs['verify-download'].steps[0].run.includes('test "$PR_RESULT" = success'));
  const capture = parse(fs.readFileSync('.github/workflows/visual-baseline-candidates.yml', 'utf8'));
  assert.equal(capture.permissions.contents, 'read');
  assert.equal(capture.jobs.capture.if, "github.ref == 'refs/heads/main'");
  assert.equal(capture.jobs.capture['runs-on'], 'ubuntu-24.04');
});

test('signing policy rejects missing protection, wildcards, tags and extra branches', () => {
  const environment = { name: 'f02-signing', deployment_branch_policy: { custom_branch_policies: true, protected_branches: false } };
  const policies = { total_count: 1, branch_policies: [{ name: 'main', type: 'branch' }] };
  assert.doesNotThrow(() => validateSigningPolicy(environment, policies));
  assert.throws(() => validateSigningPolicy({ name: 'f02-signing' }, policies));
  for (const branch of [{ name: '*', type: 'branch' }, { name: 'main', type: 'tag' }]) {
    assert.throws(() => validateSigningPolicy(environment, { total_count: 1, branch_policies: [branch] }));
  }
  assert.throws(() => validateSigningPolicy(environment, { total_count: 2, branch_policies: [...policies.branch_policies, { name: 'dev', type: 'branch' }] }));
});

test('candidate import rejects tampering and stale source before writing, then imports the reviewed matrix', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'f02-candidates-'));
  const root = path.join(scratch, 'repo');
  const candidates = path.join(scratch, 'candidates');
  try {
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests/e2e'), { recursive: true });
    fs.mkdirSync(path.join(root, 'apps/terminal'), { recursive: true });
    fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
    for (const file of ['visual-baseline-candidates.mjs', 'check-visual-baselines.mjs']) {
      fs.copyFileSync(`scripts/${file}`, path.join(root, 'scripts', file));
    }
    fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules\n');
    fs.writeFileSync(path.join(root, 'apps/terminal/input.txt'), 'original');
    fs.writeFileSync(path.join(root, 'tests/e2e/visual-baselines.json'), JSON.stringify({ schema: 'quantos-visual-baselines/v1', maxDiffPixelRatio: 0.005, entries: [] }));
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-q'); git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
    const sha = git('rev-parse', 'HEAD');
    const bytes = PNG.sync.write(new PNG({ width: 1440, height: 900 }));
    const files = requiredVisualPaths('linux').map((relative) => {
      fs.mkdirSync(path.dirname(path.join(candidates, relative)), { recursive: true });
      fs.writeFileSync(path.join(candidates, relative), bytes);
      return { path: relative, sha256: createHash('sha256').update(bytes).digest('hex'), width: 1440, height: 900, scope: 'test fixture' };
    });
    fs.writeFileSync(path.join(candidates, 'receipt.json'), JSON.stringify({ schema: 'quantos-visual-candidates/v1', status: 'CANDIDATE_REQUIRES_REVIEW', commit: sha, runner: 'ubuntu-24.04', run: 'https://github.com/SumAlphaAI/QuantOS/actions/runs/1', files }));
    const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/visual-baseline-candidates.mjs'), 'import-reviewed', candidates, sha], { encoding: 'utf8' });
    fs.writeFileSync(path.join(candidates, files[0].path), 'corrupt');
    assert.notEqual(run().status, 0);
    assert(!fs.existsSync(path.join(root, files[0].path)));
    fs.writeFileSync(path.join(candidates, files[0].path), bytes);
    fs.writeFileSync(path.join(root, 'apps/terminal/input.txt'), 'changed');
    assert.notEqual(run().status, 0);
    assert(!fs.existsSync(path.join(root, files[0].path)));
    fs.writeFileSync(path.join(root, 'apps/terminal/input.txt'), 'original');
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(validateVisualBaselines(root, { platform: 'linux' }).status, 'PASS');
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test('required download check rejects skipped or failed event-specific verification', () => {
  const ci = parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
  const script = ci.jobs['verify-download'].steps[0].run;
  for (const [event, main, pr, expected] of [
    ['push', 'success', 'skipped', 0], ['push', 'skipped', 'success', 1],
    ['push', 'failure', 'skipped', 1], ['pull_request', 'skipped', 'success', 0],
    ['pull_request', 'success', 'skipped', 1], ['workflow_dispatch', 'success', 'success', 1],
  ]) {
    const result = spawnSync('bash', ['-e', '-c', script], { env: { PATH: process.env.PATH, GITHUB_EVENT_NAME: event, GITHUB_REF: 'refs/heads/main', MAIN_RESULT: main, PR_RESULT: pr } });
    assert.equal(result.status, expected, `${event}: ${main}/${pr}`);
  }
});
