"""Seal repository development acceptance, preserving managed security evidence references."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
B=Path('docs/audit/evidence/x03-replay-fix-20261014')
A=Path('docs/audit/evidence/provider-a1-remediation-20261004/x03-replay-fix-20261014')
REPORT=Path('docs/audit/X03-replay-fix-2026-10-14.md')
BASELINE='b4bd07312572d5ee8ae5c05fbfd5552bce4625fe'
S=B/'seal.json'
def sha(p):return 'sha256:'+hashlib.sha256(Path(p).read_bytes()).hexdigest()
def links():
    refs=[x for x in re.findall(r'\]\(([^)]+)\)',REPORT.read_text()) if '://' not in x and not x.startswith('#')]
    for x in refs:assert (REPORT.parent/x.split('#')[0]).exists(),x
    return len(refs)
def verify():
    r=json.loads(S.read_text());v=json.loads((B/'verification.json').read_text());assert r['sourceCommit']==v['sourceCommit'] and v['status']=='PASS_SCOPED_X03_FIX'
    for f in r['files']:assert sha(f['path'])==f['sha256'] and Path(f['path']).stat().st_size==f['bytes'],f['path']
    for f in r['managedArtifacts']:assert sha(f['path'])==f['sha256'],f['path']
    assert links()==r['reportLinks'];assert r['formalAccepted'] is False
    assert v['r1Local']=={'nodes':27,'checks':85,'profile':'R1_LOCAL','published':False};assert v['x03']['unmappedNodes']==15;assert v['stageCounts']=={'READY':0,'NOT_ASSESSED':159,'BLOCKED':0}
    print(json.dumps({'status':'PASS','sealedFiles':len(r['files']),'managedEvidenceFiles':len(r['managedArtifacts']),'frozenInputEntries':v['inputEntries'],'reportLinks':r['reportLinks']}))
if sys.argv[1:]==['--create']:
    assert not S.exists(),'preserve old seal'
    paths=set(subprocess.check_output(['git','diff','--name-only',BASELINE],text=True).splitlines());paths.update(str(p)for root in [B,A]for p in root.rglob('*')if p.is_file());paths.update([str(REPORT),str(B/'changed-files.txt'),str(S)])
    (B/'changed-files.txt').write_text('\n'.join(sorted(paths))+'\n')
    files=[{'path':p,'sha256':sha(p),'bytes':Path(p).stat().st_size}for p in sorted(paths-{str(S)})]
    S.write_text(json.dumps({'schema':'quantos-x03-replay-fix-seal/v1','sourceCommit':json.loads((B/'verification.json').read_text())['sourceCommit'],'baselineCommit':BASELINE,'files':files,'managedArtifacts':json.loads((B/'managed-artifacts.json').read_text())['artifacts'],'reportLinks':0,'formalAccepted':False},indent=2)+'\n');r=json.loads(S.read_text());r['reportLinks']=links();S.write_text(json.dumps(r,indent=2)+'\n');verify()
elif sys.argv[1:]==['--verify']:verify()
else:raise SystemExit('usage: --create | --verify')
