from pathlib import Path
import subprocess,json,re,hashlib,os,posixpath
root=Path.cwd();e=root/'docs/audit/evidence/execution-docs-relocation-20261007';rows=json.loads((e/'migration-map.json').read_text()); mapping={r['oldPath']:r['newPath'] for r in rows};checks=[]
def check(name,ok,**details):
 checks.append(dict(name=name,status='PASS' if ok else 'FAIL',**details));assert ok,(name,details)
def original(p):return subprocess.check_output(['git','show','375019f964f375f9767b4d03a85523a141fa3f0d:'+p])
link=re.compile(r'(!?\[[^\]\n]*\]\()([^\s)]*)(\))')
def normalize(text):
 text=link.sub(lambda m:m[1]+'<destination>'+m[3],text)
 for old,new in mapping.items():text=text.replace(new,old)
 return text
for row in rows:
 p=root/row['newPath'];old=original(row['oldPath']);new=p.read_bytes()
 check(row['newPath']+':location',p.is_file() and not (root/row['oldPath']).exists())
 check(row['newPath']+':sha',row['beforeSha256']=='sha256:'+hashlib.sha256(old).hexdigest() and row['afterSha256']=='sha256:'+hashlib.sha256(new).hexdigest())
 check(row['newPath']+':body',old==new if p.suffix=='.json' else normalize(old.decode())==normalize(new.decode()))
 for m in link.finditer(old.decode()):
  url=m[2]
  if not url or url.startswith(('#','/')) or re.match(r'[a-z]+:',url):continue
  dest,sep,anchor=url.partition('#');oldTarget=posixpath.normpath(posixpath.join(posixpath.dirname(row['oldPath']),dest));newTarget=mapping.get(oldTarget,oldTarget);relative=posixpath.relpath(newTarget,posixpath.dirname(row['newPath']));expected=relative if relative.startswith('.') else './'+relative
  prefix=m[1]
  for oldPath,newPath in mapping.items():prefix=prefix.replace(oldPath,newPath)
  check(row['newPath']+':link',prefix+expected+(sep+anchor if sep else '')+m[3] in new.decode(),oldUrl=url)
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only','375019f964f375f9767b4d03a85523a141fa3f0d'],text=True).splitlines();changed=subprocess.check_output(['git','diff','375019f964f375f9767b4d03a85523a141fa3f0d','--name-only'],text=True).splitlines();historical=[p for p in tracked if p.startswith(('docs/audit/','docs/gate-records/'))];allowed={'docs/gate-records/G0-current-scope-confirmations.json','docs/gate-records/G0-current-disposition.json','docs/gate-records/G0-user-confirmation-draft-2026-10-05.md'}
check('historical-bytes-preserved',not any(p in changed for p in historical if p not in allowed),files=len(historical)-len(allowed))
check('gitleaks-ignore-preserved',(root/'.gitleaksignore').read_bytes()==original('.gitleaksignore'))
stale=[]
for p in tracked:
 if p=='.gitleaksignore' or p.startswith(('docs/audit/','docs/gate-records/')) or p in mapping or not (root/p).is_file():continue
 try:text=(root/p).read_text()
 except UnicodeError:continue
 for old in mapping:
  if old in text:stale.append({'file':p,'reference':old})
check('active-root-literals-removed',not stale,stale=stale)
for p in ['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md']:
 before=original(p).decode();after=(root/p).read_text()
 oldCheckpoints=[{k:v for k,v in json.loads(m[1]).items() if k!='stage_gate'} for m in re.finditer(r'```json\s*([\s\S]*?)```',before)]
 newCheckpoints=[{k:v for k,v in json.loads(m[1]).items() if k!='stage_gate'} for m in re.finditer(r'```json\s*([\s\S]*?)```',after)]
 check(p+':checkpoint-formal-fields',oldCheckpoints==newCheckpoints)
 for field in ['task_id','task_type','iteration','depends_on','core_prerequisites','closes_core','development_status','workflow','review_status','source_commit']:
  pattern=re.compile(r'^- '+field+r':.*$',re.M)
  check(p+':'+field,pattern.findall(before)==pattern.findall(after))
 stages=re.findall(r'^- stage_gate: (\{.*\})$',after,re.M); stages.extend([json.dumps(x['stage_gate']) for m in re.finditer(r'```json\s*([\s\S]*?)```',after) if (x:=json.loads(m[1])).get('stage_gate')])
 check(p+':stages-reset',all(json.loads(g)['status']=='NOT_ASSESSED' for g in stages),count=len(stages))
for p in list(mapping.values())+['docs/execution/README.md','docs/audit/Execution-document-organization-2026-10-07.md']:
 for m in link.finditer((root/p).read_text()):
  url=m[2]
  if not url or url.startswith(('#','/')) or re.match(r'[a-z]+:',url):continue
  check(p+':target', (root/p).parent.joinpath(url.split('#')[0]).exists(),url=url)
field=root/'docs/execution/PRE-04-field-dictionary.md';before=field.read_bytes();env=os.environ.copy();env['PATH']='/private/tmp/quantos-ready-reassessment-bin:/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH'];r=subprocess.run(['pnpm','generate:pre04-fields'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);(e/'logs/generator.log').write_text(r.stdout);check('field-generator-idempotent',r.returncode==0 and before==field.read_bytes())
check('negative-tests-final', 'fail 0' in (e/'logs/negative-tests-final.log').read_text())
(e/'relocation-verification.json').write_text(json.dumps({'status':'PASS','sourceCommit':'375019f964f375f9767b4d03a85523a141fa3f0d','checks':checks},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':'PASS','checks':len(checks),'documents':len(rows),'historicalFiles':len(historical)-len(allowed)}))
