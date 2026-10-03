from pathlib import Path
import subprocess,os,time,json,io,tarfile,tempfile,shutil
root=Path(__file__).resolve().parents[4];folder=Path(__file__).parent
base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();w=Path(tempfile.mkdtemp(prefix='quantos-pre06-remediation-'))
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',base],cwd=root))) as a:a.extractall(w,filter='data')
changed=set(subprocess.check_output(['git','diff','HEAD','--name-only'],cwd=root,text=True).splitlines());changed.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines())
for name in changed:
 source=root/name;target=w/name
 if source.is_file():target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
 elif target.exists():target.unlink()
env={k:os.environ[k] for k in ['PATH','HOME','USER','LOGNAME','LANG','LC_ALL','TMPDIR'] if k in os.environ};env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH'];env['NEXT_TELEMETRY_DISABLED']='1';env['GITHUB_SHA']=base;env['CI']='true'
env.update({'NEXT_PUBLIC_QUANTOS_ENV':'local-mock','NEXT_PUBLIC_SITE_ORIGIN':'https://sumalpha.ai','NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN':'http://localhost:3190','NEXT_PUBLIC_QUANTOS_BFF_ORIGIN':'http://localhost:4010','NEXT_PUBLIC_QUANTOS_OIDC_ISSUER':'https://mock.idp.local','NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID':'quantos-terminal-ci','NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI':'http://localhost:3190/auth/callback','NEXT_PUBLIC_QUANTOS_DEFAULT_MODE':'paper','NEXT_PUBLIC_QUANTOS_MOCK_ENABLED':'true','NEXT_PUBLIC_QUANTOS_OBS_ENABLED':'false','NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET':'off'})
results=[]
def run(name,args):
 start=time.monotonic()
 with (folder/(name+'.log')).open('w') as out:
  try:code=subprocess.run(args,cwd=w,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=240).returncode
  except subprocess.TimeoutExpired:code=124
 results.append({'name':name,'command':args,'exit_code':code,'seconds':round(time.monotonic()-start,3),'log':name+'.log'})
 (folder/'commands.json').write_text(json.dumps({'baseline':base,'workspace':str(w),'scope':'Git archive plus working-tree overlay; frozen offline install with host cache; controlled CI mock env; macOS browsers; no database/target operations','results':results},indent=2)+'\n');print(name,code,flush=True)
 if name=='bootstrap' and code:raise SystemExit('bootstrap failed')
commands=[('bootstrap',['pnpm','install','--offline','--frozen-lockfile']),('pre06',['pnpm','check:pre06']),('pre06-negative',['pnpm','test:pre06']),('contract',['pnpm','test:contract']),('sabotage',['pnpm','sabotage:pre06']),('visual-inventory',['pnpm','check:visual-baselines']),('visual-linux',['pnpm','check:visual-baselines','--platform','linux']),('visual-darwin',['pnpm','check:visual-baselines','--platform','darwin']),('generated',['pnpm','check:bff-generated']),('contract-coverage',['pnpm','check:bff-contract-coverage']),('pre04',['pnpm','check:pre04']),('pre05',['pnpm','check:pre05']),('lint',['pnpm','lint']),('typecheck',['pnpm','typecheck']),('unit',['pnpm','test']),('web-coverage',['pnpm','coverage:web']),('plans',['pnpm','check:development-plans']),('browser-install-inventory',['pnpm','exec','playwright','install','--dry-run']),('build-website',['pnpm','--filter','@sumalpha/website','build']),('build-terminal',['pnpm','--filter','@sumalpha/terminal','build']),('perf-terminal',['pnpm','check:perf']),('perf-website',['pnpm','check:perf','apps/website/out'])]
for name,args in commands:run(name,args)
if (w/'coverage/coverage-summary.json').exists():shutil.copy2(w/'coverage/coverage-summary.json',folder/'coverage-summary.json')
if (w/'coverage/critical/coverage-summary.json').exists():shutil.copy2(w/'coverage/critical/coverage-summary.json',folder/'critical-coverage-summary.json')
for app in ['terminal','website']:
 for browser in ['chromium','firefox','webkit']:
  name=app+'-'+browser;env['PLAYWRIGHT_JSON_OUTPUT_FILE']=str(folder/(name+'.json'))
  script='test:browser'+(':website' if app=='website' else '')
  run(name,['pnpm',script,'--project='+browser,'--workers=2','--reporter=list,json','--retries=0','--update-snapshots=none'])
print('complete',flush=True)
