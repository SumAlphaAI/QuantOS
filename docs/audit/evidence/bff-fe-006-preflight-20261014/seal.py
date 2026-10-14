"""Seal preflight evidence and preserve baseline evidence without executing targets."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
B=Path('docs/audit/evidence/bff-fe-006-preflight-20261014')
REPORT=Path('docs/audit/BFF-FE-006-local-preflight-2026-10-14.md')
BASELINE='45bde37547419f85db56f39b5c90475e7165e3a9'
S=B/'seal.json'
def sha(p):return 'sha256:'+hashlib.sha256(Path(p).read_bytes()).hexdigest()
def links():
    xs=[x for x in re.findall(r'\]\(([^)]+)\)',REPORT.read_text()) if '://' not in x and not x.startswith('#')]
    for x in xs:assert (REPORT.parent/x.split('#')[0]).exists(),x
    return len(xs)
def verify():
    r=json.loads(S.read_text());v=json.loads((B/'verification.json').read_text());assert r['sourceCommit']==v['sourceCommit'] and v['status']=='PASS_WITH_LOCAL_GAPS'
    for f in r['files']:assert sha(f['path'])==f['sha256'] and Path(f['path']).stat().st_size==f['bytes'],f['path']
    assert links()==r['reportLinks'];assert r['formalAccepted'] is False
    probes=json.loads((B/'evidence-negatives-01/results.json').read_text());assert probes['status']=='PASS' and probes['restored'] and len(probes['probes'])==8
    for p in probes['probes']:assert p['status']=='REJECTED' and p['exitCode']==1 and sha(p['log'])==p['logSha256']
    inputs=json.loads((B/'attempt-01/inputs.json').read_text());tree={}
    for row in subprocess.check_output(['git','ls-tree','-r','-z',r['sourceCommit']]).split(b'\0'):
        if row:
            meta,path=row.split(b'\t',1);tree[path.decode()]=meta.split()[2].decode()
    for i in inputs['inputs']:
        p=Path(i['path']);data=p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest();assert sha(p)==i['sha256'] and tree[str(p)]==blob,str(p)
    print(json.dumps({'status':'PASS','sealedFiles':len(r['files']),'frozenInputFiles':len(inputs['inputs']),'reportLinks':r['reportLinks']}))
if sys.argv[1:]==['--create']:
    assert not S.exists(),'preserve seals'
    paths=set(subprocess.check_output(['git','diff','--name-only',BASELINE],text=True).splitlines());paths.update(str(p) for p in B.rglob('*') if p.is_file());paths.update([str(REPORT),str(B/'changed-files.txt'),str(S)])
    (B/'changed-files.txt').write_text('\n'.join(sorted(paths))+'\n');files=[{'path':p,'sha256':sha(p),'bytes':Path(p).stat().st_size}for p in sorted(paths-{str(S)})]
    S.write_text(json.dumps({'schema':'quantos-bff006-preflight-seal/v1','sourceCommit':json.loads((B/'verification.json').read_text())['sourceCommit'],'baselineCommit':BASELINE,'files':files,'reportLinks':0,'formalAccepted':False},indent=2)+'\n');r=json.loads(S.read_text());r['reportLinks']=links();S.write_text(json.dumps(r,indent=2)+'\n');verify()
elif sys.argv[1:]==['--verify']:verify()
else:raise SystemExit('usage: --create | --verify')
