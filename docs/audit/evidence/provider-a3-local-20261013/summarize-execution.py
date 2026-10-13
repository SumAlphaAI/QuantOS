from pathlib import Path
import json,re
base=Path('docs/audit/evidence/provider-a3-local-20261013')
attempt=Path('docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-local-20261013/attempt-01')
r=json.loads((attempt/'execution-results.json').read_text());by={x['id']:x for x in r}
text=Path(by['f01-test']['log']).read_text()
rust=re.findall(r'test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored;',text)
python=re.findall(r'(?:^|\n)(?:=+ )?(\d+) passed[^\n]* in [\d.]+s(?: =+)?',text)
web=re.findall(r'Tests\s+(\d+) passed(?:\s+\|\s+(\d+) skipped)?',text)
summary={'schema':'quantos-provider-a3-execution-summary/v1','status':'PASS' if len(r)==140 and all(x['status']=='PASS' for x in r) else 'FAIL','observedSourceCommit':json.loads((attempt/'local-prerequisites.json').read_text())['observedSourceCommit'],'nodes':42,'groups':len(r),'passed':sum(x['status']=='PASS' for x in r),'splicedResults':False,'workspace':{'rustPassed':sum(int(x[0]) for x in rust),'rustFailed':sum(int(x[1]) for x in rust),'rustIgnored':sum(int(x[2]) for x in rust),'pythonPassed':list(map(int,python)),'web':[{'passed':int(a),'skipped':int(b or 0)} for a,b in web]},'products':{},'databaseExecution':False,'externalExecution':False,'performanceAccepted':False,'formalAccepted':False}
for key in ['a2-local-http','bff003-local-rust','bff005-http']:
 check=by[key];product=json.loads(Path(check['artifact']).read_text());records=product if isinstance(product,list) else product.get('records',product.get('responses',[]));summary['products'][key]={'artifact':check['artifact'],'schema':product.get('schema') if isinstance(product,dict) else 'research operation response array','status':product.get('status') if isinstance(product,dict) else 'validated by probe checker','records':len(records),'operationIds':sorted(set(x.get('operationId',x.get('operation','')) for x in records)),'keys':list(product) if isinstance(product,dict) else list(product[0])}
(base/'execution-summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n');print(json.dumps(summary,indent=2,ensure_ascii=False))
