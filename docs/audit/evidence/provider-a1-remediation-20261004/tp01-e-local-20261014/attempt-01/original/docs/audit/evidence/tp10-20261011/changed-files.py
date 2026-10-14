from pathlib import Path
import subprocess
root=Path.cwd();p=root/'docs/audit/evidence/tp10-20261011/changed-files.txt';p.touch(exist_ok=True)
paths=set(subprocess.check_output(['git','diff','--name-only','fce63183e2fed6b61dd07321649b94dfba9bded6'],text=True).splitlines())
paths.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines())
p.write_text('\n'.join(sorted(paths))+'\n');print('changed files',len(paths))
