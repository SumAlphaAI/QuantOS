from pathlib import Path
import subprocess
root=Path.cwd();p=root/'docs/audit/evidence/tp03-readmission-20261011/changed-files.txt';p.touch(exist_ok=True)
paths=set(subprocess.check_output(['git','diff','--name-only','be5bc89da66c4d168d73f077b275d2bb374e8153'],text=True).splitlines())
paths.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines())
p.write_text('\n'.join(sorted(paths))+'\n');print('changed files',len(paths))
