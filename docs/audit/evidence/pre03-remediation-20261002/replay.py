from pathlib import Path
import io,json,os,subprocess,tarfile,tempfile,time,shutil
root=Path(__file__).resolve().parents[4]; evidence=Path(__file__).parent
workspace=Path(tempfile.mkdtemp(prefix='quantos-pre03-fixed-'))
base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',base],cwd=root))) as archive:archive.extractall(workspace,filter='data')
changed=set(subprocess.check_output(['git','diff','HEAD','--name-only'],cwd=root,text=True).splitlines())
changed.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines())
for relative in changed:
 source=root/relative; target=workspace/relative
 if source.is_file():target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
 elif target.exists():target.unlink()
env=os.environ.copy();env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH'];env['NEXT_TELEMETRY_DISABLED']='1';env['STORYBOOK_DISABLE_TELEMETRY']='1';env['GITHUB_SHA']=base
for line in (workspace/'env/local-mock.env.example').read_text().splitlines():
 if line and not line.startswith('#') and '=' in line:
  key,value=line.split('=',1);env[key]=value
commands=[('bootstrap',['pnpm','install','--frozen-lockfile','--offline']),('plans',['pnpm','check:development-plans']),('plan-negative',['pnpm','test:development-plans']),('lint',['pnpm','lint']),('typecheck',['pnpm','typecheck']),('unit',['pnpm','test']),('build',['pnpm','build']),('storybook',['pnpm','--filter','@sumalpha/ui','build-storybook']),('web-smoke',['pnpm','check:pre03']),('web-negative',['pnpm','test:pre03']),('desktop-reference',['pnpm','test:pre03:desktop']),('node-lock',['node','scripts/check-node-lock.mjs']),('pre02',['pnpm','check:pre02']),('pre02-negative',['pnpm','test:pre02']),('browser-terminal',['pnpm','exec','playwright','test','tests/e2e/command.spec.ts','--project=chromium','--grep','路由可打开','--workers=1']),('browser-website',['pnpm','exec','playwright','test','--config','playwright.website.config.ts','--project=chromium','--grep','首页呈现|全部首期页面','--workers=1'])]
results=[];start=time.monotonic()
def save():
 (evidence/'clean-run.json').write_text(json.dumps({'base_sha':base,'overlay_files':sorted(changed),'workspace':str(workspace),'profile':'env/local-mock.env.example; existing pnpm download cache; fresh tracked source + working changes','seconds':round(time.monotonic()-start,3),'results':results},ensure_ascii=False,indent=2)+'\n')
for name,cmd in commands:
 t=time.monotonic()
 with (evidence/(name+'.log')).open('w') as out:
  try:code=subprocess.run(cmd,cwd=workspace,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=180).returncode
  except subprocess.TimeoutExpired:code=124
 results.append({'name':name,'command':cmd,'exit_code':code,'seconds':round(time.monotonic()-t,3),'log':name+'.log'});save();print(name,code,results[-1]['seconds'],flush=True)
 if code:break
if all(x['exit_code']==0 for x in results) and len(results)==len(commands):
 code='import {sourceDigest} from "./scripts/pre03-build-receipt.mjs"; console.log(sourceDigest(process.cwd()));'
 digest=subprocess.check_output(['node','--input-type=module','-e',code],cwd=workspace,env=env,text=True).strip()
 (evidence/'source.json').write_text(json.dumps({'base_sha':base,'source_digest':digest,'build_receipts':{app:json.loads((workspace/f'apps/{app}/out/pre03-build.json').read_text()) for app in ['terminal','website']}},indent=2)+'\n')

if all(x['exit_code']==0 for x in results) and len(results)==len(commands):
 import signal,urllib.request
 services=[]
 try:
  for app,port in [('website',3000),('terminal',3100)]:
   out=(evidence/(app+'-start.log')).open('w')
   process=subprocess.Popen(['pnpm','--filter','@sumalpha/'+app,'start'],cwd=workspace,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
   services.append((process,out))
   deadline=time.monotonic()+15
   while True:
    if process.poll() is not None:raise RuntimeError(app+' start exited before readiness')
    try:
     with urllib.request.urlopen(f'http://127.0.0.1:{port}/pre03-build.json',timeout=1) as response:
      receipt=json.load(response);assert receipt['sourceDigest']==digest
     break
    except (OSError,ValueError):
     if time.monotonic()>deadline:raise
     time.sleep(.1)
  with (evidence/'start-browser.json').open('w') as out:
   code=subprocess.run(['node',str(evidence/'start-check.mjs')],cwd=workspace,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=45).returncode
  assert code==0,'standard start/browser check failed'
 finally:
  for process,out in services:
   if process.poll() is None:os.killpg(process.pid,signal.SIGTERM)
   process.wait(timeout=10);out.close()
 desktop=workspace/'apps/terminal-desktop';backup=workspace/'desktop-isolated'
 desktop.rename(backup)
 try:
  with (evidence/'web-isolation.log').open('w') as out:
   code=subprocess.run(['pnpm','check:pre03'],cwd=workspace,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=45).returncode
  assert code==0,'Web smoke must pass without Desktop files'
 finally:backup.rename(desktop)
 (evidence/'supplemental.json').write_text(json.dumps({'start_browser':'PASS','real_404':'PASS','desktop_removed_web_smoke':'PASS','source_digest':digest},indent=2)+'\n')
 print('standard start, real 404, browser and Desktop isolation PASS',flush=True)
