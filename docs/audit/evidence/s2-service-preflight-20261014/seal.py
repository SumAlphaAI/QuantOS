"""Seal S2 development preflight documents and raw evidence; never grants a Gate."""
import hashlib
import json
import re
import sys
from pathlib import Path

B = Path('docs/audit/evidence/s2-service-preflight-20261014')
REPORT = Path('docs/audit/S2-SERVICE-local-preflight-2026-10-14.md')
SEAL = B / 'seal.json'


def sha(path):
    return 'sha256:' + hashlib.sha256(Path(path).read_bytes()).hexdigest()


def links():
    refs = [x for x in re.findall(r'\]\(([^)]+)\)', REPORT.read_text())
            if '://' not in x and not x.startswith('#')]
    for ref in refs:
        assert (REPORT.parent / ref.split('#')[0]).is_file(), ref
    return len(refs)


def verify():
    seal = json.loads(SEAL.read_text())
    verified = json.loads((B / 'verification.json').read_text())
    assert seal['sourceCommit'] == verified['sourceCommit']
    assert verified['status'] == 'PASS_WITH_LOCAL_GAPS'
    assert verified['closureNodes'] == 39 and verified['tp01ClosureNodes'] == 31
    assert verified['revalidatedR1Nodes'] == 27 and verified['revalidatedR1Checks'] == 85
    assert verified['expectedLocalGapRefusals'] == 4
    assert verified['unmappedNodes'] == 12 and verified['missingConsumerHandlers'] == 11
    assert seal['gate'] == 'NOT_ASSESSED' and seal['formalAccepted'] is False
    assert verified['stageCounts'] == {'READY': 0, 'NOT_ASSESSED': 159, 'BLOCKED': 0}
    for entry in seal['files']:
        assert sha(entry['path']) == entry['sha256'], entry['path']
        assert Path(entry['path']).stat().st_size == entry['bytes'], entry['path']
    actual = {str(p) for p in B.rglob('*') if p.is_file() and p != SEAL} | {str(REPORT)}
    assert actual == {entry['path'] for entry in seal['files']}
    assert links() == seal['reportLinks']
    negative = json.loads((B / 'receipt-negatives.json').read_text())
    assert negative['exitCode'] == 0 and sha(negative['log']) == negative['logSha256']
    log = Path(negative['log']).read_text()
    assert '# tests 21\n' in log and '# pass 21\n' in log and '# fail 0\n' in log
    red = (B / 'development-probe-01.log').read_text()
    assert 'ℹ pass 50\n' in red and 'ℹ fail 1\n' in red
    green = (B / 'development-probe-02.log').read_text()
    assert '# pass 51\n' in green and '# fail 0\n' in green
    print(json.dumps({'status': 'PASS', 'sealedFiles': len(seal['files']),
                      'sourceCommit': seal['sourceCommit'], 'reportLinks': seal['reportLinks'],
                      'gate': 'NOT_ASSESSED', 'formalAccepted': False}))


if sys.argv[1:] == ['--create']:
    assert not SEAL.exists(), 'preserve old seal'
    paths = {str(p) for p in B.rglob('*') if p.is_file()} | {
        str(REPORT), str(B / 'changed-files.txt'), str(SEAL)}
    (B / 'changed-files.txt').write_text('\n'.join(sorted(paths)) + '\n')
    files = [{'path': p, 'sha256': sha(p), 'bytes': Path(p).stat().st_size}
             for p in sorted(paths - {str(SEAL)})]
    SEAL.write_text(json.dumps({
        'schema': 'quantos-s2-service-preflight-seal/v1',
        'sourceCommit': json.loads((B / 'verification.json').read_text())['sourceCommit'],
        'baselineCommit': '59e6f418600ec569fcdae5f1cacdb865b20d0c42',
        'files': files, 'reportLinks': 0, 'gate': 'NOT_ASSESSED', 'formalAccepted': False,
    }, indent=2) + '\n')
    result = json.loads(SEAL.read_text())
    result['reportLinks'] = links()
    SEAL.write_text(json.dumps(result, indent=2) + '\n')
    verify()
elif sys.argv[1:] == ['--verify']:
    verify()
else:
    raise SystemExit('usage: --create | --verify')
