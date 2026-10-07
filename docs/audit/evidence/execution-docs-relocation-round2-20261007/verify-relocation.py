from pathlib import Path
import re,posixpath,subprocess,json,hashlib
root=Path.cwd();e=root/'docs/audit/evidence/execution-docs-relocation-round2-20261007';migration=json.loads((e/'migration-map.json').read_text());source=migration['sourceCommit'];rows=migration['files'];mapping={r['oldPath']:r['newPath'] for r in rows};checks=[]
def original(p):return subprocess.check_output(['git','show',source+':'+p])
def check(name,ok,**detail):
 checks.append(dict(name=name,status='PASS' if ok else 'FAIL',**detail));assert ok,(name,detail)
link=re.compile(r'(!?\[[^\]\n]*\]\()([^\s)]*)(\))')
def normalize(s):return link.sub(lambda m:m[1]+'<destination>'+m[3],s)
for r in rows:
 p=root/r['newPath'];old=original(r['oldPath']);new=p.read_bytes()
 check(r['newPath']+':moved',p.is_file() and not(root/r['oldPath']).exists())
 check(r['newPath']+':body',normalize(old.decode())==normalize(new.decode()))
 check(r['newPath']+':sha256',hashlib.sha256(old).hexdigest()==r['beforeSha256'] and hashlib.sha256(new).hexdigest()==r['afterSha256'])
 for m in link.finditer(old.decode()):
  url=m[2]
  if not url or url.startswith(('#','/')) or re.match(r'[a-z]+:',url):continue
  target,sep,anchor=url.partition('#');oldTarget=posixpath.normpath(posixpath.join(posixpath.dirname(r['oldPath']),target));newTarget=mapping.get(oldTarget,oldTarget);relative=posixpath.relpath(newTarget,posixpath.dirname(r['newPath']));relative=relative if relative.startswith('.') else './'+relative
  check(r['newPath']+':link-rebased',m[1]+relative+(sep+anchor if sep else '')+m[3] in new.decode(),oldUrl=url)
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',source],text=True).splitlines();changed=subprocess.check_output(['git','diff',source,'--name-only'],text=True).splitlines();history=[p for p in tracked if p.startswith(('docs/audit/','docs/gate-records/'))]
check('historical-bytes-preserved',not any(p in changed for p in history),files=len(history))
check('previous-execution-files-preserved',all((root/p).read_bytes()==original(p) for p in tracked if p.startswith('docs/execution/') and p!='docs/execution/README.md'))
stale=[];incoming=[]
for p in tracked:
 if p.startswith(('docs/audit/','docs/gate-records/')) or not(root/p).is_file():continue
 try:s=(root/p).read_text()
 except UnicodeError:continue
 for old in mapping:
  if old in s:stale.append(dict(file=p,reference=old))
 if p.endswith('.md'):
  for m in link.finditer(s):
   url=m[2]
   if not url or url.startswith(('#','/')) or re.match(r'[a-z]+:',url):continue
   target=posixpath.normpath(posixpath.join(posixpath.dirname(p),url.split('#')[0]))
   if target in mapping:stale.append(dict(file=p,reference=url))
   if target in mapping.values():incoming.append(dict(file=p,target=target));check(p+':incoming-link', (root/target).is_file())
check('active-old-paths-removed',not stale,stale=stale)
for p in list(mapping.values())+['docs/execution/README.md','docs/audit/Execution-document-organization-round2-2026-10-07.md']:
 for m in link.finditer((root/p).read_text()):
  url=m[2]
  if not url or url.startswith(('#','/')) or re.match(r'[a-z]+:',url):continue
  check(p+':link-target',(root/p).parent.joinpath(url.split('#')[0]).exists(),url=url)
for p in ['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md']:
 before=original(p).decode();after=(root/p).read_text()
 fields=['task_id','task_type','iteration','stage_gate','depends_on','core_prerequisites','closes_core','development_status','workflow','当前工程复核']
 for field in fields:
  pat=re.compile(r'^- '+field+r'[:：].*$',re.M);check(p+':'+field,pat.findall(before)==pat.findall(after))
 blocks=lambda text:[json.loads(m[1]) for m in re.finditer(r'```json\s*([\s\S]*?)```',text)]
 check(p+':checkpoint-fields',blocks(before)==blocks(after))
check('g0-pending',json.loads((root/'docs/gate-records/G0-current-scope-confirmations.json').read_text())['status']=='PENDING')
result=dict(status='PASS',sourceCommit=source,documents=len(rows),deleted=0,checks=checks);(e/'relocation-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(dict(status='PASS',documents=len(rows),checks=len(checks),historicalFiles=len(history))))
