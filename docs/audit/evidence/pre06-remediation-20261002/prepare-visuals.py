from pathlib import Path
import io,tarfile,tempfile,subprocess,shutil,json,os
f=Path(__file__).resolve().parent;root=f.parents[3];base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();w=Path(tempfile.mkdtemp(prefix='quantos-pre06-visuals-'))
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',base],cwd=root))) as archive:archive.extractall(w,filter='data')
changed=set(subprocess.check_output(['git','diff','HEAD','--name-only'],cwd=root,text=True).splitlines());changed.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines())
for name in changed:
 p=root/name;q=w/name
 if p.is_file():q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
 elif q.exists():q.unlink()
env={k:os.environ[k] for k in ['PATH','HOME','USER','LANG','TMPDIR'] if k in os.environ};env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH'];env['CI']='true';env['GITHUB_SHA']=base;env['NEXT_TELEMETRY_DISABLED']='1'
env.update({'NEXT_PUBLIC_QUANTOS_ENV':'local-mock','NEXT_PUBLIC_SITE_ORIGIN':'https://sumalpha.ai','NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN':'http://localhost:3190','NEXT_PUBLIC_QUANTOS_BFF_ORIGIN':'http://localhost:4010','NEXT_PUBLIC_QUANTOS_OIDC_ISSUER':'https://mock.idp.local','NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID':'quantos-terminal-ci','NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI':'http://localhost:3190/auth/callback','NEXT_PUBLIC_QUANTOS_DEFAULT_MODE':'paper','NEXT_PUBLIC_QUANTOS_MOCK_ENABLED':'true','NEXT_PUBLIC_QUANTOS_OBS_ENABLED':'false','NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET':'off'})
results=[]
for name,args in [('install',['pnpm','install','--offline','--frozen-lockfile']),('build-terminal',['pnpm','--filter','@sumalpha/terminal','build']),('firefox',['pnpm','test:browser','--project=firefox','--workers=2','--update-snapshots=missing','--retries=0']),('webkit',['pnpm','test:browser','--project=webkit','--workers=2','--update-snapshots=missing','--retries=0'])]:
 with (f/('visual-prepare-'+name+'.log')).open('w') as out:r=subprocess.run(args,cwd=w,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=240)
 results.append({'name':name,'command':args,'exit_code':r.returncode});(f/'visual-prepare.json').write_text(json.dumps({'baseline':base,'workspace':str(w),'scope':'capture missing macOS snapshots only; existing baseline bytes preserved; engineering comparison pending','results':results},indent=2)+'\n');print(name,r.returncode,flush=True)
 if r.returncode and name in ['install','build-terminal']:raise SystemExit('preparation failed')
manifest=json.loads((root/'tests/e2e/visual-baselines.json').read_text());old={e['path'] for e in manifest['entries']};new=[]
for p in (w/'tests/e2e').rglob('*.png'):
 name=str(p.relative_to(w))
 if name not in old:
  q=root/name;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q);new.append(name)
assert len(new)==7,new
(f/'captured-visual-paths.json').write_text(json.dumps({'new_paths':sorted(new)},indent=2)+'\n');print('captured',len(new),flush=True)
