from pathlib import Path
import json,os,subprocess
folder=Path(__file__).parent
workspace=Path(json.loads((folder/'clean-run.json').read_text())['workspace'])
env={k:v for k,v in os.environ.items() if not k.startswith('NEXT_PUBLIC_')}
env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH']
env['NEXT_TELEMETRY_DISABLED']='1'
profile={}
for line in (workspace/'env/local-mock.env.example').read_text().splitlines():
 if line.startswith('NEXT_PUBLIC_'):
  key,value=line.split('=',1);profile[key]=value
results=[]
def run(name,environment,expected):
 with (folder/(name+'.log')).open('w') as out:
  code=subprocess.run(['pnpm','check:pre03'],cwd=workspace,env=environment,stdout=out,stderr=subprocess.STDOUT,timeout=45).returncode
 results.append({'name':name,'command':['pnpm','check:pre03'],'exit_code':code,'expected':expected,'result':'PASS' if (code==0)==(expected=='PASS') else 'FAIL'})
 assert results[-1]['result']=='PASS',name
run('injected-profile',env|profile,'PASS')
file=workspace/'apps/terminal/.env.local'; original=file.read_text()
try:
 file.write_text(original.replace('quantos-terminal-local','quantos-terminal-recheck'))
 run('changed-env-file',env,'FAIL')
finally:file.write_text(original)
run('changed-injection',env|profile|{'NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID':'quantos-terminal-recheck'},'FAIL')
(folder/'profile-check.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
