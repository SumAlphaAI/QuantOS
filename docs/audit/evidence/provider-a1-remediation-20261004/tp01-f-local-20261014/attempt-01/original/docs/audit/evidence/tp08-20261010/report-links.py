from pathlib import Path
import re,json
root=Path.cwd();p=root/'docs/audit/TP08-development-2026-10-10.md';targets=[]
output=root/'docs/audit/evidence/tp08-20261010/report-links.json'
output.touch(exist_ok=True)
for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)',p.read_text()):
 if link.startswith(('http:','https:','#')):continue
 path=(p.parent/link.split('#')[0]).resolve();assert path.is_relative_to(root) and path.is_file(),link
 targets.append(str(path.relative_to(root)))
r={'schema':'quantos-tp08-report-links/v1','status':'PASS','formalAccepted':False,'report':str(p.relative_to(root)),'localLinks':len(targets),'allExist':True}
output.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
