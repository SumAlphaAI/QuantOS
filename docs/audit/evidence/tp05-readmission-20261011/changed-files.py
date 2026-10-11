from pathlib import Path
import subprocess
root=Path.cwd();p=root/'docs/audit/evidence/tp05-readmission-20261011/changed-files.txt';p.touch(exist_ok=True)
paths=set(subprocess.check_output(['git','diff','--name-only','4911fa76255494334bea5066e5a7b40c076aae8d'],text=True).splitlines())
paths.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines())
p.write_text('\n'.join(sorted(paths))+'\n');print('changed files',len(paths))
