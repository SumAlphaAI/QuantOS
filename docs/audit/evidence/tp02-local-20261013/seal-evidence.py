"""Seal bytes, historical archives, and candidate Git inputs without rerunning targets."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
BASE=Path('docs/audit/evidence/tp02-local-20261013')
ATTEMPT=Path('docs/audit/evidence/provider-a1-remediation-20261004/tp02-local-20261013')
REPORT=Path('docs/audit/TP02-local-admission-2026-10-13.md')
SOURCE=json.loads((BASE/'manifest.json').read_text())['observedSourceCommit']
BASELINE='2c603df049c0c7842c24e98f2c8b372d2522557f'
SEAL=BASE/'seal.json'
def sha(b):return 'sha256:'+hashlib.sha256(b).hexdigest()
def links():
    refs=[x for x in re.findall(r'\]\(([^)]+)\)',REPORT.read_text()) if '://' not in x and not x.startswith('#')]
    for x in refs:assert (REPORT.parent/x.split('#')[0]).exists(),x
    return len(refs)
def frozen_inputs():
    wrapper=json.loads((BASE/'manifest.json').read_text());assert wrapper['observedSourceCommit']==SOURCE
    index=json.loads(Path(wrapper['localPrerequisites']['manifest']).read_text());inputs={}
    for n in index['nodes']:
        for i in json.loads(Path(n['manifest']).read_text())['inputs']:
            if i['path'] in inputs:assert inputs[i['path']]==i
            inputs[i['path']]=i
    tree={}
    for r in subprocess.check_output(['git','ls-tree','-r','-z',SOURCE]).split(b'\0'):
        if r:
            meta,path=r.split(b'\t',1);tree[path.decode()]=meta.split()[2].decode()
    gitlinks=0
    for path,i in inputs.items():
        if 'gitCommit' in i:
            gitlinks+=1;blob=i['gitCommit'];actual=sha(('gitlink:'+blob).encode())
            assert subprocess.check_output(['git','-C',path,'rev-parse','HEAD'],text=True).strip()==blob
            assert not subprocess.check_output(['git','-C',path,'status','--porcelain'],text=True).strip()
        else:
            b=Path(path).read_bytes();actual=sha(b);blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        assert actual==i['sha256'],path
        assert tree[path]==blob,path+': differs from candidate'
    verified=json.loads((BASE/'verification.json').read_text());assert len(inputs)==verified['inputEntries']
    return {'status':'PASS','inputs':len(inputs),'files':len(inputs)-gitlinks,'gitlinks':gitlinks}
def verify():
    r=json.loads(SEAL.read_text());assert r['sourceCommit']==SOURCE
    for i in r['files']:
        b=Path(i['path']).read_bytes();assert sha(b)==i['sha256'],i['path'];assert len(b)==i['bytes'],i['path']
    assert frozen_inputs()==r['frozenInputVerification'];assert links()==r['reportLinks']
    results=json.loads((BASE/r['finalAttempt']/'results.json').read_text());assert len(results)==15 and all(c['status']=='PASS' for c in results)
    for c in results:assert sha(Path(c['log']).read_bytes())==c['logSha256']
    wheel=json.loads((BASE/r['finalAttempt']/'wheel-inspection.json').read_text());assert wheel['status']=='PASS' and wheel['embeddedCatalog'] and not wheel['editable'] and wheel['sourceCommit']==SOURCE
    probes=json.loads((BASE/r['finalAttempt']/'actual-negative.json').read_text());assert probes['restored'] and probes['status']=='PASS' and probes['cases']==26
    print(json.dumps({'status':'PASS','sealedFiles':len(r['files']),'frozenInputs':r['frozenInputVerification']['inputs'],'reportLinks':r['reportLinks']}))
if sys.argv[1:]==['--create']:
    assert not SEAL.exists(),'preserve old seal'
    paths=set(subprocess.check_output(['git','diff','--name-only',BASELINE],text=True).splitlines())
    paths.update(str(p) for root in [BASE,ATTEMPT] for p in root.rglob('*') if p.is_file())
    paths.update([str(REPORT),str(BASE/'changed-files.txt'),str(SEAL)])
    (BASE/'changed-files.txt').write_text('\n'.join(sorted(paths))+'\n')
    finals=sorted(p.name for p in BASE.glob('final-*') if (p/'results.json').exists())
    files=[{'path':p,'sha256':sha(Path(p).read_bytes()),'bytes':Path(p).stat().st_size} for p in sorted(paths-{str(SEAL)})]
    SEAL.write_text(json.dumps({'schema':'quantos-tp02-local-evidence-seal/v1','sourceCommit':SOURCE,'baselineCommit':BASELINE,'files':files,'frozenInputVerification':frozen_inputs(),'reportLinks':0,'finalAttempt':finals[-1]},indent=2)+'\n')
    record=json.loads(SEAL.read_text());record['reportLinks']=links();SEAL.write_text(json.dumps(record,indent=2)+'\n');verify()
elif sys.argv[1:]==['--verify']:verify()
else:raise SystemExit('usage: --create | --verify')
