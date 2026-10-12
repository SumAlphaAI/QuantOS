"""Inspect the actual newly built wheels and embedded fixture bytes; no installation or network."""
import hashlib,json,sys,zipfile
from pathlib import Path
out=Path(sys.argv[1]);files=[]
for name,required in [('quantos_engine_sdk-0.1.0-py3-none-any.whl','quantos_engine_sdk/__init__.py'),('quantos_rd_agent-0.1.0-py3-none-any.whl','rd_agent/fixtures/catalog.json')]:
 p=Path('artifacts/tp02-packaged/wheels')/name
 with zipfile.ZipFile(p) as z:
  assert required in z.namelist()
  if name.startswith('quantos_rd_agent'):
   embedded=z.read(required);actual=Path('engines/rd-agent/src/rd_agent/fixtures/catalog.json').read_bytes();assert embedded==actual
   catalog=json.loads(embedded);assert [f['fixture_name'] for f in catalog['fixtures']]==['hypothesis_regime_shift','experiment_factor_stability']
   assert z.read('rd_agent/service.py')==Path('engines/rd-agent/src/rd_agent/service.py').read_bytes()
   catalog_sha='sha256:'+hashlib.sha256(embedded).hexdigest()
  assert not any(n.endswith('.pth') or 'direct_url.json' in n for n in z.namelist())
  files.append({'file':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'requiredMember':required})
r={'schema':'quantos-tp02-wheel-inspection/v1','status':'PASS','wheels':files,'catalogSha256':catalog_sha,'fixtureNames':['hypothesis_regime_shift','experiment_factor_stability'],'embeddedCatalog':True,'editable':False,'realUpstreamRuntime':False,'formalAccepted':False}
out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,sort_keys=True))
