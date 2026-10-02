from pathlib import Path
import os,json,time,subprocess
root=Path(__file__).resolve().parents[4];evidence=Path(__file__).parent;workspace=Path(json.loads((evidence/'workspace.json').read_text())['workspace'])
env=os.environ.copy();env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH']
for line in (workspace/'env/local-mock.env.example').read_text().splitlines():
 if line and not line.startswith('#') and '=' in line:
  k,v=line.split('=',1);env[k]=v
commands=[('browser-terminal',['pnpm','exec','playwright','test','tests/e2e/command.spec.ts','--project=chromium','--grep','路由可打开','--workers=1']),('browser-website',['pnpm','exec','playwright','test','--config','playwright.website.config.ts','--project=chromium','--grep','首页呈现|全部首期页面','--workers=1']),('website-start',['pnpm','--filter','@sumalpha/website','start']),('terminal-start',['pnpm','--filter','@sumalpha/terminal','start']),('node-lock',['node','scripts/check-node-lock.mjs'])]
results=[]
for name,cmd in commands:
 t=time.monotonic()
 with (evidence/(name+'.log')).open('w') as out:
  try:r=subprocess.run(cmd,cwd=workspace,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=90);code=r.returncode
  except subprocess.TimeoutExpired:code=124
 results.append({'name':name,'command':cmd,'exit_code':code,'seconds':round(time.monotonic()-t,3),'log':name+'.log'})
 print(name,code,flush=True)
(evidence/'supplemental.json').write_text(json.dumps(results,indent=2)+'\n')
