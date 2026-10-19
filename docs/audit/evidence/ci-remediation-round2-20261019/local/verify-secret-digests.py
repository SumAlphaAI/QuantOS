from pathlib import Path
import json,hashlib,subprocess,re
base=Path(__file__).resolve().parents[1]
findings=json.loads((base/'remote/gitleaks-before.json').read_text())
expected='docs/audit/evidence/bff-fe-006-local-20261019/preflight/history-sha256.json'
cache={};verified=set()
for f in findings:
    assert f['File']==expected and f['RuleID']=='generic-api-key'
    commit=f['Commit']
    if commit not in cache:
        raw=subprocess.check_output(['git','show',commit+':'+expected]).decode()
        cache[commit]=(raw.splitlines(),json.loads(raw))
    lines,entries=cache[commit]
    line=lines[f['StartLine']-1]
    m=re.fullmatch(r'\s*"([^"\\]+)": "([a-f0-9]{64})",?',line)
    assert m,(f['StartLine'],line)
    p,expected_hash=m.groups()
    assert entries[p]==expected_hash
    content=subprocess.check_output(['git','show',commit+':'+p])
    assert hashlib.sha256(content).hexdigest()==expected_hash,p
    verified.add((commit,p))
fingerprints=set(Path('.gitleaksignore').read_text().splitlines())
assert all(f['Fingerprint'] in fingerprints for f in findings)
print('PASS:',len(findings),'reviewed findings match',len(verified),'Git blobs and exact ignore fingerprints')
