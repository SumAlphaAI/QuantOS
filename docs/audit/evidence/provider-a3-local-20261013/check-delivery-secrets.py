"""Scan only changed, versioned deliverables; never read local secret configuration."""
from pathlib import Path
import subprocess,tempfile,shutil,json,hashlib,os,datetime
root=Path.cwd();base=root/'docs/audit/evidence/provider-a3-local-20261013'
baseline='3967d49206f9ec6a7c7663262694e08975418fa3'
def git(*args):return subprocess.check_output(['git',*args],text=True).splitlines()
files=sorted(set(git('diff','--name-only',baseline))|set(git('ls-files','--others','--exclude-standard')))
assert all(not p.startswith('.git/') and not p.startswith('.env') for p in files)
binary=os.environ.get('GITLEAKS_BIN',str(root/'artifacts/tools/gitleaks'))
assert subprocess.check_output([binary,'version'],text=True).strip()=='8.28.0'
with tempfile.TemporaryDirectory(prefix='quantos-a3-delivery-scan-') as scan:
 inputs=[]
 for file in files:
  src=root/file;assert src.is_file(),file
  dst=Path(scan)/file;dst.parent.mkdir(parents=True,exist_ok=True);data=src.read_bytes();dst.write_bytes(data);inputs.append({'path':file,'sha256':'sha256:'+hashlib.sha256(data).hexdigest()})
 command=[binary,'dir',scan,'--config',str(root/'.gitleaks.toml'),'--gitleaks-ignore-path',str(root/'.gitleaksignore'),'--redact','--no-banner','--report-format','json','--report-path',str(base/'gitleaks-report.json')]
 env={k:v for k,v in os.environ.items() if not any(s in k for s in ['DATABASE_URL','SUPABASE','PASSWORD','TOKEN','SECRET'])}
 p=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env)
 (base/'gitleaks.log').write_bytes(p.stdout)
 report={'status':'PASS' if p.returncode==0 else 'FAIL','exitCode':p.returncode,'command':command,'scope':'changed versioned source, documentation and evidence only; no local secret configuration','scannedFiles':len(files),'inputs':inputs,'logSha256':'sha256:'+hashlib.sha256(p.stdout).hexdigest(),'databaseExecution':False,'externalExecution':False,'formalAccepted':False}
 (base/'gitleaks-scan.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='inputs'},indent=2));assert p.returncode==0
