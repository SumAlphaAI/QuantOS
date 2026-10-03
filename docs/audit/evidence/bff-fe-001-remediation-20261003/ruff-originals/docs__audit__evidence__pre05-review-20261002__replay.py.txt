from pathlib import Path
import subprocess,os,time,json,io,tarfile,tempfile
root=Path(__file__).resolve().parents[4];folder=Path(__file__).parent
base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
workspace=Path(tempfile.mkdtemp(prefix='quantos-pre05-review-'))
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',base],cwd=root))) as archive:archive.extractall(workspace,filter='data')
env={k:os.environ[k] for k in ['PATH','HOME','USER','LOGNAME','LANG','LC_ALL','TMPDIR'] if k in os.environ}
env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH'];env['NEXT_TELEMETRY_DISABLED']='1';env['GITHUB_SHA']=base
commands=[('bootstrap',['pnpm','install','--frozen-lockfile','--offline']),('pre05',['pnpm','check:pre05']),('pre05-tests',['pnpm','test:pre05']),('plans',['pnpm','check:development-plans']),('lint',['pnpm','lint']),('typecheck',['pnpm','typecheck']),('unit',['pnpm','test']),('contract',['pnpm','test:contract'])]
results=[]
def run(name,command,settings=env,expect=0):
 start=time.monotonic()
 with (folder/(name+'.log')).open('w') as out:
  try:code=subprocess.run(command,cwd=workspace,env=settings,stdout=out,stderr=subprocess.STDOUT,timeout=240).returncode
  except subprocess.TimeoutExpired:code=124
 results.append({'name':name,'command':command,'exit_code':code,'expected_exit':expect,'seconds':round(time.monotonic()-start,3),'log':name+'.log'})
 (folder/'commands.json').write_text(json.dumps({'baseline':base,'workspace':str(workspace),'scope':'Git archive, fresh frozen offline install; host download cache; no database or external service execution','results':results},indent=2)+'\n')
 print(name,code,flush=True)
 if (code!=0 if expect==0 else code==0):raise SystemExit('unexpected result; inspect log')
for name,cmd in commands:run(name,cmd)
for app in ['website','terminal']:run('missing-env-'+app,['pnpm','--filter','@sumalpha/'+app,'build'],expect='nonzero')
# Each profile is built in isolation using only its public configuration.
for profile in ['local-mock','local-integrated','staging']:
 settings=env.copy()
 for line in (workspace/f'env/{profile}.env.example').read_text().splitlines():
  if line.startswith('NEXT_PUBLIC_'):
   key,value=line.split('=',1);settings[key]=value
 for app in ['website','terminal']:run(profile+'-'+app,['pnpm','--filter','@sumalpha/'+app,'build'],settings)
 (folder/(profile+'-artifacts.json')).write_text(json.dumps({app:{'html_files':len(list((workspace/f'apps/{app}/out').rglob('*.html'))),'js_files':len(list((workspace/f'apps/{app}/out').rglob('*.js')))} for app in ['website','terminal']},indent=2)+'\n')
print('validation complete',flush=True)
