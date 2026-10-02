from pathlib import Path
import json,hashlib,subprocess
f=Path(__file__).resolve().parent;r=f.parents[3];audit=r/'docs/audit';previous=f.parent/'pre06-remediation-20261002'
def load(p):return json.loads(p.read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
c=load(f/'commands.json');w=Path(c['workspace']);assert len(c['results'])==28 and all(v['exit_code']==0 for v in c['results'])
for name,count in [('mutations.json',11),('supplement.json',5),('inactive-tests.json',11)]:
 data=load(f/name);assert len(data['results'])==count and all(v['exit_code']==1 for v in data['results'])
assert load(f/'probes.json')['unexpected_accepts']==0 and load(f/'critical-branch-negative.json')['exit_code']==1
assert all(v['errorCount']==0 for v in load(f/'script-lint.json'))
stats={a+'-'+b:load(f/(a+'-'+b+'.json'))['stats'] for a in ['terminal','website'] for b in ['chromium','firefox','webkit']};assert sum(v['expected'] for v in stats.values())==135
assert all(v[k]==0 for v in stats.values() for k in ['unexpected','skipped','flaky'])
critical=load(f/'critical-coverage-summary.json');coverage=load(f/'coverage-summary.json')['total'];assert len(critical)==6 and all(v[k]['pct']==100 for v in critical.values() for k in ['lines','statements','functions','branches'])
prev=load(previous/'manifest.json')
for name,sha in prev['artifact_sha256'].items():assert digest(previous/name)==sha,name
assert digest(f/'previous-current-report.md')==prev['report_sha256']
paths=set(filter(None,subprocess.check_output(['git','ls-files','-z'],cwd=r).decode().split('\0')));paths.update(filter(None,subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=r).decode().split('\0')))
inputs={}
for name in paths:
 if name.startswith(('apps/','packages/','scripts/','tests/','.github/workflows/','env/')) or name in ['AGENTS.md','Makefile','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','playwright.config.ts','playwright.website.config.ts','vitest.config.ts','vitest.coverage.config.ts','vitest.critical.config.ts','eslint.config.mjs','tsconfig.base.json','docs/PRE-06-summary.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md']:
  p=r/name
  if p.is_file():assert p.read_bytes()==(w/name).read_bytes(),name;inputs[name]=digest(p)
closure=load(previous/'issue-closure.json');closure['recheck_baseline']=c['baseline'];closure['initial_recheck']={'closed':8,'residual':1,'residual_id':'H-02'}
evidence={'H-01':['contract.log','probes.json'],'H-02':['pre06-negative.log','mutations.json','inactive-tests.json'],'M-01':['contract.log','mutations.json'],'M-02':['perf-terminal.log','perf-website.log','supplement.json'],'M-03':['terminal-flaky.json','website-flaky.json'],'M-04':['visual-inventory.log','visual-linux.log','visual-darwin.log','terminal-firefox.json','terminal-webkit.json'],'M-05':['critical-coverage-summary.json','critical-branch-negative.log'],'M-06':['manifest.json','plans.log'],'L-01':['pre06-negative.log','visual-runtime-negative.json','visual-runtime-negative-artifacts']}
for issue in closure['issues']:
 issue['evidence']=evidence[issue['id']]
 if issue['id']=='H-02':issue['repair']+=' 本轮追加检查正常注册的测试/测试组，以及截图断言必须直接await、无提前return/throw或运行时skip/fixme。四项原误放行场景与11个真实入口探针已拒绝。'
save(f/'issue-closure.json',closure)
matrix=load(previous/'task-matrix.json');matrix['recheck_baseline']=c['baseline']
for control in matrix['controls']:
 if control['id'] in ['C14','C16']:control['verification']+='；新增跳过测试/测试组及非执行分支拒绝，11个实际入口进程退出1'
save(f/'task-matrix.json',matrix)
boundary='本次仅验收仓库工程门禁及macOS本地Web mock重放。Linux视觉清单完整，但Linux浏览器执行、远端CI及附件上传、正式G0/指定模型与owner签署、真实服务/账号、数据库和Desktop/native仍为 **NOT RUN / NO RECEIPT**。未进行数据库操作。'
main=audit/'PRE-06-comprehensive-review-2026-10-02.md';detail=audit/'PRE-06-recheck-2026-10-02.md'
main.write_text(f'''# PRE-06 测试基线复审报告

> 复核日期：2026-10-02；复核起点：`{c['baseline']}`；结论：补修后工程验收通过。
> 当前证据：[再复核记录](./PRE-06-recheck-2026-10-02.md) · [源码与证据清单](./evidence/pre06-recheck-20261002/manifest.json)

## 一、任务完成概况

原9项问题已全部解决，当前待整改问题为0：阻塞0、高危0、中危0、低危0。20项工程控制点全部通过，完成率 **20/20＝100%**。

本轮独立复核发现H-02仍可放行跳过测试及不执行的截图断言，已补修并通过新增负向验证。其余8项修复经源码、原有探针及当前重放再次确认。逐项关闭详情放入[复核台账](./evidence/pre06-recheck-20261002/issue-closure.json)，本报告仅保留当前验收信息。

## 二、完成情况明细统计

| 验收范围 | 当前结果 |
|---|---|
| 工程控制点 | PASS20、PARTIAL0、FAIL0；[完整20项矩阵](./evidence/pre06-recheck-20261002/task-matrix.json) |
| 主检查与构建 | 28项全部退出0，包括PRE04/PRE05联动、代码规范、类型、生成及计划检查、两应用构建与性能 |
| 单元、契约、门禁 | 单元187项、契约17项、PRE06负向16项通过 |
| 浏览器与可访问性 | 官网与Terminal的Chromium/Firefox/WebKit共135项通过，失败/跳过/flaky均0；禁止自动更新基线 |
| 视觉基线 | Linux/macOS各12张，共24张；完整性检查及实际像素破坏检测通过 |
| 覆盖率 | 全局行{coverage['lines']['pct']}%；5个关键文件逐文件行/语句/函数/分支100%，98/98关键分支 |
| 误放行防护 | 原14项独立探针零误放行；原11项及新增11项实际入口破坏均退出1；6项性能/像素/关键分支补充负向均拒绝 |
| CI失败证据 | 两workflow的always上传与14天保留配置受检，本地实际trace、差异图和报告已留存 |

## 三、当前问题与验收边界

当前无未解决的工程问题。{boundary}

历史材料独立保留：[初审报告](./PRE-06-comprehensive-review-history-2026-10-02.md)、[首轮整改记录](./PRE-06-remediation-2026-10-02.md)、[本轮前的结论快照](./evidence/pre06-recheck-20261002/previous-current-report.md)。历史结论不替代本轮验收。

## 四、后续维护要求

新增fixture、关键政策、平台或预算时同步清单及正负回归。保持全局80%和关键文件100%双门槛、flaky阻断、实际截图比较及失败附件归档。按执行计划另取目标环境与正式签署回执。
''')
rows='\n'.join('| '+v['id']+' | '+v['severity']+' | CLOSED | '+ '、'.join('['+name+'](./evidence/pre06-recheck-20261002/'+name+')' for name in v['evidence'])+' |' for v in closure['issues'])
detail.write_text(f'''# PRE-06 再复核记录

> 日期：2026-10-02；起点提交：`{c['baseline']}`；验证对象：该提交加本轮补修，Git导出新副本、冻结离线依赖、Node24.12.0/pnpm10.20.0、公开CI mock配置。最终输入哈希见[manifest](./evidence/pre06-recheck-20261002/manifest.json)。

## 1. 复核结论

9项原问题在复核开始时8项关闭、H-02存在残余；补修后9项全部关闭。20项工程控制点通过，完成率100%。{boundary}

## 2. 本轮发现与修复

原AST检查只确认截图调用存在，未确认所属测试正常注册及调用位置。实际将视觉用例改为test.skip、测试组改为test.describe.skip、截图放在if(false)，以及契约组改为describe.skip，均错误返回PASS，见[修复前探针](./evidence/pre06-recheck-20261002/before.json)。这属于H-02残余，不新增或重复计算另一高危。

修复在`scripts/pre06-test-structure.mjs`检查模块/正常测试组中的注册路径，拒绝跳过组、条件注册和未调用helper；截图必须位于正常test的直接await表达式，无提前return/throw和运行时skip/fixme。新增负向用例同时覆盖未等待截图、提前返回和todo组。真实文件变异分别经结构、独立sabotage、浏览器/契约入口执行，共11个进程全部退出1并报missing executable，见[inactive-tests.json](./evidence/pre06-recheck-20261002/inactive-tests.json)。静态约束与实际回归共同保护当前基线，不声称穷尽任意程序语义或未来恶意修改。

## 3. 九项问题关闭核对

| 原编号 | 优先级 | 状态 | 当前证据 |
|---|---|---|---|
{rows}

## 4. 验证结果与留存

28项[主命令](./evidence/pre06-recheck-20261002/commands.json)全部成功；单元187、契约17、门禁负向16项；macOS六组浏览器135/135，retries0、update-snapshots=none，零失败/跳过/flaky。全局行{coverage['lines']['pct']}%，关键5文件四维100%（111行、126语句、27函数、98分支）；实际插入未测分支后覆盖率门禁退出1。

原14项探针零误放行；原11项实际文件变异、新11项停用测试变异均拒绝。两应用路由超预算/过期回执4项、像素变化1项、未测关键分支1项全部拒绝。两应用共享JS139.4KB、最大chunk58.5KB，Terminal CSS10.7KB/官网4.4KB；最大路由167.1KB/141.7KB，预算200KB。完整性检查确认24PNG未变更。

主报告精简为当前状态、验收指标、边界和维护要求；执行计划更新至3.12。首轮整改文件与证据保持原字节；旧主报告另存快照并与原manifest哈希核对。新证据独立留存，未覆写历史回执。正式目标/G0验收仍需独立证据。
''')
manifest={'schema':'quantos-pre06-recheck/v1','date':'2026-10-02','baseline':c['baseline'],'result':'PASS_REPOSITORY_ENGINEERING','issues':{'initial_closed':8,'initial_residual':['H-02'],'final_closed':9,'final_open':0},'controls':{'PASS':20,'PARTIAL':0,'FAIL':0},'strict_completion_percent':100,'binding':'recorded inputs byte-identical to restored final replay workspace; final report documents bound separately; commit identity available through Git','validation':{'main_commands_passed':28,'unit_tests':187,'contract_tests':17,'pre06_negative_tests':16,'browser_stats':stats,'coverage':coverage,'critical_totals':critical['total'],'original_probe_unexpected_accepts':0,'old_mutations_rejected':11,'new_mutations_rejected':11,'supplement_rejected':6,'script_lint_errors':0},'boundary':boundary,'previous_artifact_hashes_verified':True,'input_sha256':dict(sorted(inputs.items())),'report_sha256':digest(main),'detail_report_sha256':digest(detail)}
manifest['artifact_sha256']={str(p.relative_to(f)):digest(p) for p in sorted(f.rglob('*')) if p.is_file() and p.name!='manifest.json'};save(f/'manifest.json',manifest);print('PASS: 9 closed, 20 controls,',len(inputs),'source bindings')
