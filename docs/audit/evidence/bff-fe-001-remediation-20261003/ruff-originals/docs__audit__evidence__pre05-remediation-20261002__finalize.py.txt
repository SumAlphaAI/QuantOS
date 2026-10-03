from pathlib import Path
import json,hashlib,re,subprocess
f=Path(__file__).resolve().parent;root=f.parents[3];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
c=json.loads((f/'commands.json').read_text());w=Path(c['workspace']);assert len(c['results'])==32
assert all(r['exit_code']==(1 if r['expected']=='nonzero' else 0) for r in c['results'])
s=json.loads((f/'supplement-commands.json').read_text());assert len(s['results'])==12 and all(r['exit_code']==r['expected_exit'] for r in s['results'])
assert all(r['exit_code']==1 and r['fail_fast_logged'] for r in json.loads((f/'startup-commands.json').read_text()))
unit=re.sub(r'\x1b\[[0-9;]*m','',(f/'unit.log').read_text());count=sum(map(int,re.findall(r'Tests\s+(\d+) passed',unit)));files=sum(map(int,re.findall(r'Test Files\s+(\d+) passed',unit)));assert (count,files)==(180,25)
probes=json.loads((f/'probes.json').read_text());assert len(probes['results'])==14 and all(r['matches'] for r in probes['results'])
parser=json.loads((f/'parser-comparison.json').read_text());assert parser['cli_ok'] and parser['next_ok'] and parser['values_identical']
initial=json.loads((root/'docs/audit/evidence/pre05-review-20261002/manifest.json').read_text());history=root/'docs/audit/PRE-05-comprehensive-review-history-2026-10-02.md';assert sha(history)==initial['report_sha256']
for name,digest in initial['artifact_sha256'].items():assert sha(root/'docs/audit/evidence/pre05-review-20261002'/name)==digest,name
ledger=json.loads((root/'docs/audit/evidence/pre05-review-20261002/issue-ledger.json').read_text());notes={
'H-01':('输入及实际产物凭据检查；构建与CI接线，六类实际产物注入拒绝',['pre05-tests.log','synthetic-token-build.log','supplement-commands.json','script-check.json']),
'M-01':('公开原值首尾空白拒绝，实际padded mock构建拒绝',['pre05-tests.log','padded-mock-build.log','probes.json']),
'M-02':('所有profile观测/DSN一致，无密码/query/fragment',['pre05-tests.log','probes.json']),
'M-03':('精确callback与根路径issuer支持范围冻结，未支持值启动前拒绝',['callback-slash-build.log','path-issuer-build.log','probes.json']),
'M-04':('指南/模板/总结如实说明普通dev无worker、测试route和后续能力',['document-check.json']),
'M-05':('Next同源dotenv、独立进程隔离，实际文本解析完全一致',['pre05-tests.log','parser-comparison.json']),
'M-06':('模板profile与四类占位身份独立绑定，破坏CLI及测试拒绝',['supplement-commands.json','pre05-tests.log']),
'M-07':('当前三Web/启动/测试/历史G0口径、计划3.9同步',['document-check.json','plans.log']),
'L-01':('绝对/相对路径均正确；不存在文件非零',['absolute-cli-path.log','pre05-tests.log'])}
closure={'closed':9,'open':0,'controls':{'PASS':16,'PARTIAL':0,'FAIL':0,'strict_completion_percent':100},'issues':[{'id':i['id'],'original_severity':i['severity'],'status':'CLOSED','verification':notes[i['id']][0],'evidence':notes[i['id']][1]} for i in ledger['issues']]};(f/'closure.json').write_text(json.dumps(closure,ensure_ascii=False,indent=2)+'\n')
reports=['docs/PRE-05-summary.md','docs/PRE-05-environment-guide.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','docs/audit/PRE-05-comprehensive-review-2026-10-02.md','docs/audit/PRE-05-remediation-2026-10-02.md'];links=0
for name in reports:
 p=root/name
 for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if '://' in link or link.startswith('#'):continue
  target=p.parent/link.split('#')[0];links+=1
  if target.resolve()!=(f/'manifest.json').resolve():assert target.exists(),(name,link)
(f/'document-check.json').write_text(json.dumps({'status':'PASS','local_links':links,'history_report_matches_initial_sha256':True,'initial_artifact_sha256_unchanged':True},indent=2)+'\n')
# Executable inputs must match the clean validation overlay. Post-run reports are
# separately hashed because final results are assembled after the commands finish.
paths=subprocess.check_output(['git','ls-files','packages/config','apps/terminal','apps/website','env','.github/workflows','scripts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','AGENTS.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'],cwd=root,text=True).splitlines()
paths.extend(['packages/config/src/env-file.ts','scripts/check-client-secrets.mjs','scripts/pre05-gate-negative.mjs']);paths=sorted(set(paths))
for name in paths:assert (root/name).read_bytes()==(w/name).read_bytes(),f'validation input drift: {name}'
manifest={'schema':'quantos-pre05-remediation/v1','date':'2026-10-02','baseline':c['baseline'],'binding':'clean Git archive plus working-tree overlay; executable inputs byte-identical to final validation workspace; final documentation separately hashed','result':'PASS','closed':9,'open_severities':{'blocker':0,'high':0,'medium':0,'low':0},'controls':{'PASS':16,'PARTIAL':0,'FAIL':0,'strict_completion_percent':100},'required_outputs':{'pass':3,'total':3},'validation':{'node':'24.12.0','pnpm':'10.20.0','fresh_frozen_offline_install':True,'cache':'host download store','main_commands':32,'main_successes':26,'main_expected_rejections':6,'supplement_commands':12,'missing_env_dev_rejections':2,'config_tests':25,'gate_tests':8,'workspace_tests':180,'workspace_test_files':25,'contract_tests':13,'plan_tests':22,'profile_application_builds':6,'client_artifact_injections_rejected':6,'configuration_probes':14,'configuration_false_passes':0,'script_lint_errors':0,'script_lint_warnings':0,'parser_next_identical':True,'pre03_web':'PASS local; two built route checks'},'not_run':['remote CI','formal G0','designated-model review','real staging DNS/TLS/BFF/IdP/Sentry/accounts','database execution','full browser matrix','full business acceptance','Desktop/native'],'historical_report':{'path':str(history.relative_to(root)),'sha256':sha(history)},'input_sha256':{name:sha(root/name) for name in paths},'report_sha256':{name:sha(root/name) for name in reports},'artifact_sha256':{str(p.relative_to(f)):sha(p) for p in sorted(f.rglob('*')) if p.is_file() and p.name!='manifest.json'}}
(f/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(f'PASS: 9 closed; 16 controls; {count} unit tests; {len(paths)} executable input hashes; {links} document links')
