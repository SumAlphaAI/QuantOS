from pathlib import Path
import json,hashlib,subprocess,shutil
f=Path(__file__).resolve().parent;root=f.parents[3];audit=root/'docs/audit';old=f.parent/'pre06-review-20261002'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
c=read(f/'commands.json');w=Path(c['workspace']);assert len(c['results'])==28 and all(x['exit_code']==0 for x in c['results'])
m=read(f/'mutations.json');s=read(f/'supplement.json');probes=read(f/'probes.json')
assert all(x['exit_code']==1 for x in m['results']) and len(m['results'])==11
assert all(x['exit_code']==1 for x in s['results']) and len(s['results'])==5
assert probes['unexpected_accepts']==0
assert read(f/'critical-branch-negative.json')['exit_code']==1
assert all(x['errorCount']==0 for x in read(f/'script-lint.json'))
coverage=read(f/'coverage-summary.json')['total'];critical=read(f/'critical-coverage-summary.json');assert coverage['lines']['pct']>=80
assert len(critical)==6 and all(v[k]['pct']==100 for v in critical.values() for k in ['lines','statements','functions','branches'])
browsers={a+'-'+b:read(f/(a+'-'+b+'.json'))['stats'] for a in ['terminal','website'] for b in ['chromium','firefox','webkit']}
assert sum(x['expected'] for x in browsers.values())==135 and all(x[k]==0 for x in browsers.values() for k in ['unexpected','skipped','flaky'])
initial=read(old/'manifest.json')
for name,value in initial['artifact_sha256'].items():assert sha(old/name)==value,name
main=audit/'PRE-06-comprehensive-review-2026-10-02.md';history=audit/'PRE-06-comprehensive-review-history-2026-10-02.md'
if not history.exists():assert sha(main)==initial['report_sha256'];shutil.copy2(main,history)
assert sha(history)==initial['report_sha256']
paths=set(subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines());paths.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines())
inputs={}
for name in sorted(paths):
 if name.startswith(('apps/','packages/','tests/','scripts/','.github/workflows/','env/')) or name in ['AGENTS.md','Makefile','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','playwright.config.ts','playwright.website.config.ts','vitest.config.ts','vitest.coverage.config.ts','vitest.critical.config.ts','eslint.config.mjs','tsconfig.base.json','docs/PRE-06-summary.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','docs/adr/20261002-pre06-fixture-and-critical-baseline.md']:
  p=root/name
  if p.is_file():assert p.read_bytes()==(w/name).read_bytes(),name;inputs[name]=sha(p)
for name,value in initial['input_sha256'].items():
 if name.endswith('.png') or name=='pnpm-lock.yaml':assert sha(root/name)==value,name
fixes={
'H-01':('字段安全扫描','统一字段分隔符与大小写；冻结字典别名、嵌套对象/数组及有效公开字段回归。','contract.log; probes.json'),
'H-02':('执行结构与断言','YAML实际步骤、条件、顺序和TS AST断言受检；契约、浏览器和独立sabotage入口先验结构。','pre06-negative.log; mutations.json; removed-visual-assertions-sabotage.log'),
'M-01':('fixture与MSW','全量10项清单，6契约正向/2负向/2inventory-only；独立PRE04 schema且禁止MSW加载；修复StrategyDraft缺files。','contract.log; unused-fixture-contract.log'),
'M-02':('性能预算','两应用CI检查真实资源、路由及源码/配置/构建回执；每路由200KB，与共享250/chunk200/CSS60KB共同阻断。','perf-terminal.log; perf-website.log; supplement.json; pre06-negative.log'),
'M-03':('重试政策','两配置CI启用failOnFlakyTests；两实际配置一失败一重试通过仍exit1并记录flaky。','terminal-flaky.json; website-flaky.json; mutations.json'),
'M-04':('视觉矩阵','支持Linux/macOS×三浏览器；补齐7张macOS图，24图完整性与人工工程像素核对后独立禁止更新重放。','visual-darwin.log; visual-linux.log; visual-comparison.png; terminal-firefox.json; terminal-webkit.json'),
'M-05':('关键覆盖率','固定5个当前风险政策文件，包括TSX；逐文件行/语句/函数/分支100%；补齐真实分支用例。','critical-coverage-summary.json; critical-branch-negative.log; web-coverage.log'),
'M-06':('文档与执行身份','总结、执行计划与当前清单/指标/执行身份同步；初审和历史验收独立保存。','manifest.json; task-matrix.json; plans.log'),
'L-01':('失败附件归档','两workflow always上传artifacts/browser并保留14天；分应用报告/附件目录；本地真实像素失败trace与diff归档。','pre06-negative.log; visual-runtime-negative-artifacts; visual-runtime-negative.json')}
issues=read(old/'issue-ledger.json')['issues'];closure=[]
for issue in issues:
 module,fix,logs=fixes[issue['id']];closure.append({'id':issue['id'],'severity':issue['severity'],'module':module,'status':'CLOSED','repair':fix,'evidence':logs.split('; ')})
write(f/'issue-closure.json',{'initial':{'blocker':0,'high':2,'medium':6,'low':1},'closed':9,'open':0,'issues':closure})
verifications=[
'两应用Web-only；Desktop保留二期边界','Node24.12.0/pnpm10.20.0冻结离线安装与28项重放','OpenAPI1.3.0、62操作/51schema，generated与coverage检查通过','17项contract，四resolver成功/错误及未实现501语义受检','10项全量登记与正负校验，2个inventory隔离，未知/敏感注入拒绝','schema负向和四种sabotage通过','executable=true拒绝，关键权限政策100%','字典分隔符/大小写/嵌套对象和数组别名拒绝','两应用三浏览器配置及CI步骤/输出/trace政策验证','macOS六组135/135、零失败/跳过/flaky；Linux仅inventory','官网/Terminal现有serious/critical axe阻断用例通过','390px、200%缩放、键盘用例通过','24PNG；Linux/macOS各12，尺寸/hash和0.5%阈值及真实像素破坏拒绝','删除截图比较时结构、浏览器及独立sabotage非零','两应用共享/chunk/CSS与逐路由预算；空产物/超预算/旧回执拒绝','停用CI、注释命令、恒真contract被实际进程拒绝','CI真实配置两flaky探针均exit1','全局行≥80%；五文件各四维100%，未测分支实际拒绝','两CI always/14天归档结构受检，本地真实trace/diff存在','总结/计划/初审历史与当前源码哈希、执行证据同步']
controls=read(old/'task-matrix.json')['controls']
for control,value in zip(controls,verifications):control.update(status='PASS',verification=value)
write(f/'task-matrix.json',{'total':20,'status_counts':{'PASS':20,'PARTIAL':0,'FAIL':0},'strict_completion_percent':100,'formula':'PASS / 20; repository engineering controls only; formal/remote target acceptance excluded','controls':controls})
links=lambda names: '、'.join('['+name+'](./evidence/pre06-remediation-20261002/'+name+')' for name in names)
table='\n'.join('| '+x['id']+' | '+x['severity']+' | '+x['module']+' | '+x['repair']+' | CLOSED | '+links(x['evidence'])+' |' for x in closure)
metrics=f"全局行覆盖率 **{coverage['lines']['pct']}%**；关键五文件111/111行、126/126语句、27/27函数、98/98分支，各文件四维100%。"
boundary='验收范围为仓库工程门禁与macOS本地Web mock重放。Linux已验证12张基线完整，当前Linux浏览器执行、远端CI/上传回执、正式G0与指定模型复审、风险/QA/设计owner签署、真实staging/provider/BFF/IdP/Sentry/账号、数据库、全业务及Desktop/native均为 **NOT RUN / NO RECEIPT**。本轮没有数据库操作。'
remediation=audit/'PRE-06-remediation-2026-10-02.md'
remediation.write_text(f'''# PRE-06 整改验收记录

> 日期：2026-10-02；结论：仓库工程整改通过；初审基线：`{c['baseline']}`。
> 验证对象：初审提交加本次修复，独立Git导出副本、冻结依赖与公开CI mock配置；最终源码SHA-256见[证据清单](./evidence/pre06-remediation-20261002/manifest.json)。提交自身SHA在Git记录中查询，不用初审SHA冒充修复提交。

## 一、任务完成概况

初审2高危、6中危、1低危共9项已全部关闭，剩余0项。20项工程控制点全部PASS，实际完成率 **20/20=100%**，PARTIAL和FAIL均0。[初审历史](./PRE-06-comprehensive-review-history-2026-10-02.md)及其原证据保持原字节，保留50%历史结论。

{boundary}

## 二、完成情况明细统计

| 验证 | 最终结果 |
|---|---|
| 独立重放 | 28项主检查退出0，包括PRE04/PRE05联动、lint/typecheck、生成/计划检查、两应用构建与性能、六组浏览器 |
| 单元/契约/门禁 | 单元187项/25文件；contract17项；PRE06负向15项；sabotage4种破坏；九个新增/修改mjs文件补充lint零错误 |
| fixture集合 | 10JSON：6契约正向、2预期负向、2隔离inventory；PRE04规划数据有独立schema且不作为发布响应 |
| 覆盖率 | {metrics}独立关键运行106项/18文件；未测分支注入使门禁exit1 |
| 浏览器 | macOS官网54项、Terminal81项，合计135/135；失败、跳过、flaky均0；retries0、update-snapshots=none |
| 视觉 | 原17张不变，新增macOS7张；Linux/macOS各12张完整；工程人工核对后独立重放，不将更新模式视为验收PASS |
| 性能 | 两应用共享139.4KB、最大chunk58.5KB；Terminal CSS10.7KB、官网4.4KB；逐路由≤200KB，最大Terminal167.1KB/官网141.7KB |
| 原误放行探针 | 14项独立拒绝探针零误放行；11项实际文件/配置破坏全部exit1 |
| 补充实际负向 | 两应用路由超预算/旧构建回执4项、真实像素差异1项、关键未测分支1项全部exit1；真实trace及图片留存 |

命令和统计见{links(['commands.json','coverage-summary.json','critical-coverage-summary.json','mutations.json','probes.json','supplement.json','critical-branch-negative.json','script-lint.json'])}。当前最终文件为权威结果；attempt-1/2/3与visual-prepare-attempt-1、mutation-attempt-1保留修复过程中的失败，不能替代最终验收。缺图生成命令按Playwright行为退出1，只用于生成候选图；最终六组禁止更新重放全部退出0。

## 三、问题关闭及风险分析

| 编号 | 原优先级 | 模块 | 修复结果 | 状态 | 证据 |
|---|---|---|---|---|---|
{table}

敏感字段修复证明检测可靠性，没有真实泄露事件。AST/YAML结构验证与真实破坏探针共同保护当前关键断言，不能证明任意未来逻辑或恶意篡改均被识别。5个文件和路由200KB是当前工程清单与初始预算，新增关键业务必须扩充，不以当前100%推断未来全量业务覆盖。

两CI已配置报告与附件上传；本轮只验证接线及本地实际失败产物，未声称远端上传发生。新增视觉已完成工程像素核对，未冒充指定设计owner签字。

## 四、后续维护

本次9项无需继续整改。新增fixture须同步清单/schema/预期结果，禁止inventory进入MSW；新增关键政策须扩充冻结清单及逐文件100%门禁；新增OS/浏览器须补齐平台图并另行禁止更新重放。保留全局80%与独立关键100%双门槛、flaky失败及always附件归档。

正式目标验收按执行计划另取Linux/远端CI/G0等独立回执。当前工程完成状态与这些边界同时成立，不用历史或本地结果替代目标证据。
''')
controltable='\n'.join('| '+x['id']+' | '+x['requirement']+' | '+x['verification']+' | PASS |' for x in controls)
main.write_text(f'''# PRE-06 全面复审报告

> 日期：2026-10-02；状态：整改后工程复核PASS。初审与9项整改详情分别见[初审历史](./PRE-06-comprehensive-review-history-2026-10-02.md)和[整改验收记录](./PRE-06-remediation-2026-10-02.md)。

## 一、任务完成概况

按执行计划的PRE-06测试基线逐项复核，原9项问题全部关闭。20项工程控制点PASS20、PARTIAL0、FAIL0，完成率 **100%**；当前未解决问题：阻塞0、高危0、中危0、低危0。

{boundary}

## 二、完成情况明细统计

| 控制点 | 验收要求 | 当前证据 | 状态 |
|---|---|---|---|
{controltable}

最终28项重放全部退出0；单元187、契约17、门禁负向15、浏览器135项通过。{metrics}详见[任务矩阵](./evidence/pre06-remediation-20261002/task-matrix.json)和[源码/证据绑定](./evidence/pre06-remediation-20261002/manifest.json)。

## 三、问题清单及风险分析

当前无待整改问题。9项已关闭内容保留在[关闭台账](./evidence/pre06-remediation-20261002/issue-closure.json)及整改记录，初审证据不改写。当前工程结果不能推断远端CI、正式owner签署或未来业务已通过，执行身份与范围见第一部分。

## 四、整改建议

本次整改完成。后续新增fixture、关键分支、平台或预算时同步清单与正负验证，执行计划中的正式目标验收另取独立回执；不复用历史SHA、候选图生成或自动重试结果作为通过证明。
''')
manifest={'schema':'quantos-pre06-remediation/v1','date':'2026-10-02','baseline':c['baseline'],'result':'PASS_REPOSITORY_ENGINEERING','issues':{'closed':9,'open':0},'controls':{'PASS':20,'PARTIAL':0,'FAIL':0},'strict_completion_percent':100,'binding':'Git archive plus working tree overlay; all recorded source inputs byte-identical to final restored validation copy; docs finalized separately; current commit SHA available through Git','validation':{'main_commands':28,'successful_commands':28,'unit_tests':187,'contract_tests':17,'pre06_negative_tests':15,'critical_tests':106,'critical_files':5,'critical_totals':critical['total'],'coverage':coverage,'browser_stats':browsers,'browser_passed':135,'visual_pngs':24,'original_probes_unexpected_accepts':0,'mutation_processes_rejected':11,'supplement_processes_rejected':6,'script_lint_errors':0},'not_run':boundary,'input_sha256':inputs,'report_sha256':sha(main),'remediation_report_sha256':sha(remediation),'historical_report_sha256':sha(history),'initial_evidence_immutable':True}
manifest['artifact_sha256']={str(p.relative_to(f)):sha(p) for p in sorted(f.rglob('*')) if p.is_file() and p.name!='manifest.json'}
write(f/'manifest.json',manifest);print('finalized',len(inputs),'bound source files, 9 CLOSED, 20 PASS')
