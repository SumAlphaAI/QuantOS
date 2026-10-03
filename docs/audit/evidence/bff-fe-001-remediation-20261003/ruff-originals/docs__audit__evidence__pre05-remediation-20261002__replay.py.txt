from pathlib import Path
import subprocess,os,time,json,io,tarfile,shutil,tempfile
root=Path(__file__).resolve().parents[4];folder=Path(__file__).parent
base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();w=Path(tempfile.mkdtemp(prefix='quantos-pre05-remediation-'))
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',base],cwd=root))) as a:a.extractall(w,filter='data')
changed=set(subprocess.check_output(['git','diff','HEAD','--name-only'],cwd=root,text=True).splitlines());changed.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines())
for path in changed:
 source=root/path;dest=w/path
 if source.is_file():dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
 elif dest.exists():dest.unlink()
env={k:os.environ[k] for k in ['PATH','HOME','USER','LOGNAME','LANG','LC_ALL','TMPDIR'] if k in os.environ};env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH'];env['NEXT_TELEMETRY_DISABLED']='1';env['GITHUB_SHA']=base;env['CI']='true'
results=[]
def run(name,args,settings=env,expect=0):
 start=time.monotonic()
 with (folder/(name+'.log')).open('w') as out:
  try:code=subprocess.run(args,cwd=w,env=settings,stdout=out,stderr=subprocess.STDOUT,timeout=240).returncode
  except subprocess.TimeoutExpired:code=124
 results.append({'name':name,'command':args,'exit_code':code,'expected':expect,'seconds':round(time.monotonic()-start,3),'log':name+'.log'})
 (folder/'commands.json').write_text(json.dumps({'baseline':base,'workspace':str(w),'overlay_files':sorted(changed),'scope':'fresh source/dependencies; host offline download store; no database or target operations','results':results},indent=2)+'\n');print(name,code,flush=True)
 if (code!=0 if expect==0 else code==0 or code==124):raise SystemExit('unexpected result; inspect log')
commands=[('bootstrap',['pnpm','install','--offline','--frozen-lockfile']),('pre05',['pnpm','check:pre05']),('pre05-tests',['pnpm','test:pre05']),('plans',['pnpm','check:development-plans']),('plan-tests',['pnpm','test:development-plans']),('lint',['pnpm','lint']),('typecheck',['pnpm','typecheck']),('unit',['pnpm','test']),('contract',['pnpm','test:contract']),('pre01',['pnpm','check:pre01']),('pre02',['pnpm','check:pre02']),('pre04',['pnpm','check:pre04']),('pre06',['pnpm','check:pre06']),('openapi',['pnpm','check:bff-openapi']),('generated',['pnpm','check:bff-generated']),('coverage',['pnpm','check:bff-contract-coverage'])]
for name,args in commands:run(name,args)
for app in ['website','terminal']:run('missing-env-'+app,['pnpm','--filter','@sumalpha/'+app,'build'],expect='nonzero')
for profile in ['local-mock','local-integrated','staging']:
 settings=env.copy()
 for line in (w/f'env/{profile}.env.example').read_text().splitlines():
  if line.startswith('NEXT_PUBLIC_'):key,value=line.split('=',1);settings[key]=value
 for app in ['website','terminal']:run(profile+'-'+app,['pnpm','--filter','@sumalpha/'+app,'build'],settings)
 run(profile+'-client-scan',['pnpm','check:client-secrets'],settings)
 if profile=='staging':run('pre03-web',['pnpm','check:pre03:web'],settings)
# Actual config loading must reject semantic and synthetic credential mutations.
settings=env.copy()
for line in (w/'env/local-mock.env.example').read_text().splitlines():
 if line.startswith('NEXT_PUBLIC_'):key,value=line.split('=',1);settings[key]=value
for name,key,value in [('synthetic-token','NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID','gh'+'p_'+'A'*36),('padded-mock','NEXT_PUBLIC_QUANTOS_MOCK_ENABLED',' true '),('path-issuer','NEXT_PUBLIC_QUANTOS_OIDC_ISSUER','https://idp.example.test/tenant/realm'),('callback-slash','NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI','http://localhost:3100/auth/callback/')]:
 modified=settings.copy();modified[key]=value;run(name+'-build',['pnpm','--filter','@sumalpha/terminal','build'],modified,'nonzero')
print('complete',flush=True)
