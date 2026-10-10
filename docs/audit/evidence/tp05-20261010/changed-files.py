from pathlib import Path
import subprocess
root=Path.cwd();p=root/'docs/audit/evidence/tp05-20261010/changed-files.txt';p.touch(exist_ok=True)
paths=set(subprocess.check_output(['git','diff','--name-only','c2b0dc5a422afbdf843476ba207902cab40f394a'],text=True).splitlines())
paths.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines())
p.write_text('\n'.join(sorted(paths))+'\n');print('changed files',len(paths))
