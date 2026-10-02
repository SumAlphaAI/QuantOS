from pathlib import Path
import subprocess,os,time,json
root=Path(__file__).resolve().parents[4];folder=Path(__file__).parent
env=os.environ.copy();env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH']
commands=[('pre04',['pnpm','check:pre04']),('pre04-negative',['pnpm','test:pre04']),('pre01',['pnpm','check:pre01']),('plans',['pnpm','check:development-plans']),('openapi',['pnpm','check:bff-openapi']),('generated',['pnpm','check:bff-generated']),('coverage',['pnpm','check:bff-contract-coverage']),('pre06',['pnpm','check:pre06']),('contract',['pnpm','test:contract'])]
results=[]
for name,command in commands:
 start=time.monotonic()
 with (folder/(name+'.log')).open('w') as out:
  try:code=subprocess.run(command,cwd=root,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=180).returncode
  except subprocess.TimeoutExpired:code=124
 results.append({'name':name,'command':command,'exit_code':code,'seconds':round(time.monotonic()-start,3),'log':name+'.log'})
 (folder/'commands.json').write_text(json.dumps({'baseline':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'scope':'current workspace static/source and contract checks; existing installed dependencies','results':results},indent=2)+'\n')
 print(name,code,flush=True)
