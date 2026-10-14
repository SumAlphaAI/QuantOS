from pathlib import Path
import subprocess
root=Path.cwd();p=root/'docs/audit/evidence/tp08-20261010/changed-files.txt';p.touch(exist_ok=True)
paths=set(subprocess.check_output(['git','diff','--name-only','19519b28b1c8aea3974f1b84919768299d4a6e1e'],text=True).splitlines())
paths.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines())
p.write_text('\n'.join(sorted(paths))+'\n');print('changed files',len(paths))
