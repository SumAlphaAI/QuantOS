from pathlib import Path
import json,os,subprocess
f=Path(__file__).resolve().parent;c=json.loads((f/'commands.json').read_text());w=Path(c['workspace']);p=w/'tests/contract/contract.test.ts';old=p.read_bytes();env=dict(os.environ);env['PATH']='/Users/anray/.nvm/versions/node/v24.12.0/bin:'+env['PATH'];env['CI']='true'
# Retain names, assertions and real calls in the syntax tree, but return before all eight required tests execute.
edit="""import ts from 'typescript';import fs from 'node:fs';import {requiredContractTests} from './scripts/pre06-test-structure.mjs';const p='tests/contract/contract.test.ts';let text=fs.readFileSync(p,'utf8');const source=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true);const offsets=[];function visit(n){if(ts.isCallExpression(n)&&n.expression.getText()==='it'&&requiredContractTests.includes(n.arguments[0]?.text))offsets.push(n.arguments[1].body.getStart()+1);ts.forEachChild(n,visit);}visit(source);if(offsets.length!==8)throw new Error('unexpected test inventory');for(const i of offsets.sort((a,b)=>b-a))text=text.slice(0,i)+' return; '+text.slice(i);fs.writeFileSync(p,text);"""
results=[]
try:
 subprocess.run(['node','--input-type=module','-e',edit],cwd=w,env=env,check=True)
 for command in ['check:pre06','test:contract','sabotage:pre06']:
  x=subprocess.run(['pnpm',command],cwd=w,env=env,capture_output=True,text=True,timeout=40);name='contract-return-'+command.replace(':','-')+'.log';(f/name).write_text(x.stdout+x.stderr);results.append({'command':['pnpm',command],'expected_exit':'nonzero','exit_code':x.returncode,'unexpected_accept':x.returncode==0,'log':name})
finally:p.write_bytes(old)
(f/'contract-return-probe.json').write_text(json.dumps({'source_commit':c['baseline'],'mutation':'early return in all 8 required contract callbacks; names/calls/assertions retained; restored after probe','results':results},indent=2)+'\n');print(results)
