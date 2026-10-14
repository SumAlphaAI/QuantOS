"""Seal local admission proof and preserve the complete failed first attempt."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

B = Path('docs/audit/evidence/tp01-e-local-20261014')
A = Path('docs/audit/evidence/provider-a1-remediation-20261004/tp01-e-local-20261014')
REPORT = Path('docs/audit/TP01-E-local-admission-2026-10-14.md')
BASELINE = '4e4316fcd1f8e4ac1babca81f0fc323dda681ea9'
SEAL = B / 'seal.json'


def sha(path):
    return 'sha256:' + hashlib.sha256(Path(path).read_bytes()).hexdigest()


def links(creating=False):
    refs = [x for x in re.findall(r'\]\(([^)]+)\)', REPORT.read_text())
            if '://' not in x and not x.startswith('#')]
    for ref in refs:
        target = REPORT.parent / ref.split('#')[0]
        assert target.is_file() or (creating and target.resolve() == SEAL.resolve()), ref
    return len(refs)


def verify():
    sealed = json.loads(SEAL.read_text())
    verification = json.loads((B / 'verification.json').read_text())
    assert verification['status'] == 'PASS'
    assert verification['sourceCommit'] == sealed['sourceCommit']
    assert verification['closureNodes'] == 28 and verification['executedChecks'] == 88
    assert verification['deferredChecks'] == 22 and verification['formalAccepted'] is False
    assert verification['stageCounts'] == {'READY': 1, 'NOT_ASSESSED': 158, 'BLOCKED': 0}
    for file in sealed['files']:
        assert sha(file['path']) == file['sha256'], file['path']
        assert Path(file['path']).stat().st_size == file['bytes'], file['path']
    assert links() == sealed['reportLinks']
    first = json.loads((A / 'attempt-01/execution-results.json').read_text())
    assert len(first) == 88
    assert sum(c['status'] == 'PASS' for c in first) == 82
    assert [c['id'] for c in first if c['status'] == 'FAIL'] == [
        'tp09-development', 'tp09-negatives', 'tp10-development',
        'tp10-negatives', 'tp11-development', 'tp11-negatives']
    assert not (A / 'attempt-01/local-prerequisites.json').exists()
    assert json.loads((A / 'attempt-01/failure.json').read_text())['status'] == 'FAIL'
    second = json.loads((A / 'attempt-02/execution-results.json').read_text())
    assert len(second) == 88 and all(c['status'] == 'PASS' for c in second)
    rollback = json.loads((A / 'attempt-02/publication-failure.json').read_text())
    assert rollback['rolledBack'] is True and rollback['phase'] == 'publication'
    interrupted = json.loads((A / 'attempt-03/interruption.json').read_text())
    assert interrupted['status'] == 'INTERRUPTED' and interrupted['completedChecks'] == 4
    assert not (A / 'attempt-03/local-prerequisites.json').exists()
    fourth = json.loads((A / 'attempt-04/execution-results.json').read_text())
    assert len(fourth) == 88 and sum(c['status'] == 'PASS' for c in fourth) == 87
    timeout = next(c for c in fourth if c['id'] == 'f01-test')
    assert timeout['status'] == 'FAIL' and timeout['timedOut'] is True
    assert timeout['executionErrorCode'] == 'ETIMEDOUT' and timeout['timeoutMs'] == 1800000
    assert not (A / 'attempt-04/local-prerequisites.json').exists()
    post = json.loads((B / 'post-checks.json').read_text())
    assert len(post) == 7 and all(c['exitCode'] == c['expectedExitCode'] for c in post)
    for check in post:
        assert sha(check['log']) == check['logSha256']
    negative = (B / 'post-closure-negatives.log').read_text()
    assert '# tests 16\n' in negative and '# pass 16\n' in negative and '# fail 0\n' in negative
    print(json.dumps({'status': 'PASS', 'sealedFiles': len(sealed['files']),
                      'sourceCommit': sealed['sourceCommit'], 'failedAttempt': '82 PASS / 6 FAIL',
                      'closureNodes': 28, 'executedChecks': 88, 'postChecks': 7,
                      'reportLinks': sealed['reportLinks'], 'formalAccepted': False}))


if sys.argv[1:] == ['--create']:
    assert not SEAL.exists(), 'preserve old seal'
    paths = set(subprocess.check_output(['git', 'diff', '--name-only', BASELINE], text=True).splitlines())
    paths.update(str(p) for root in [B, A] for p in root.rglob('*') if p.is_file())
    paths.update([str(REPORT), str(B / 'changed-files.txt'), str(SEAL)])
    (B / 'changed-files.txt').write_text('\n'.join(sorted(paths)) + '\n')
    files = [{'path': p, 'sha256': sha(p), 'bytes': Path(p).stat().st_size}
             for p in sorted(paths - {str(SEAL)})]
    SEAL.write_text(json.dumps({'schema': 'quantos-tp01-e-local-seal/v1',
                               'sourceCommit': json.loads((B / 'verification.json').read_text())['sourceCommit'],
                               'baselineCommit': BASELINE, 'files': files,
                               'reportLinks': links(creating=True), 'formalAccepted': False}, indent=2) + '\n')
    verify()
elif sys.argv[1:] == ['--verify']:
    verify()
else:
    raise SystemExit('usage: --create | --verify')
