from pathlib import Path
import json
f=Path(__file__).resolve().parent;root=f.parents[3]
issues=[
{'id':'H-01','severity':'高危','module':'tests/contract/validate.mjs:17–42；sensitive-fields.json','manifestation':'敏感字段仅转小写后做包含匹配，未统一分隔符。向有效 SessionContext 注入 vault_path、bearer_token、model_key，schema 与敏感扫描均返回无问题；相同语义的 camelCase 名称在禁用字典中。signing_key 已由既有模式检出，不列为漏洞。','impact':'BFF fixture/响应校验可接受 Vault 路径、令牌或模型秘密字段的常见别名。仅证明检测缺陷，无真实秘密泄露证据。','evidence':['probes.json'],'remediation':'规范化字段名或明确冻结等价别名，覆盖嵌套对象/数组；对每个字典条目生成别名正负探针，并验证有效公开字段不误拒绝。'},
{'id':'H-02','severity':'高危','module':'scripts/check-pre06.mjs:46–76；pre06-gate-negative.mjs','manifestation':'结构 Gate 按文本 includes 判断执行与测试存在。实际 CI 官网步骤 if:false 后仍退出0；把 contract 测试替成一个恒真用例并只在注释留5个标记，结构与契约检查均退出0。删除全部 toHaveScreenshot 断言后，结构、破坏自检和27项 Chromium测试仍通过；保留基线完整性不能证明页面像素仍比较。纯模型探针还放行全部 run 命令变成 echo 注释、删除 sabotage 接线。','impact':'PRE-06 完成标准所依赖的真实执行链可退化，现有负向用例不能可靠阻断删除断言或停用关键步骤。这里是本地门禁误放行，不宣称完整远端 CI 已运行成功。','evidence':['probes.json','mutations.json','disabled-ci-step-pre06.log','marker-only-contract-pre06.log','marker-only-contract-tests.log','removed-visual-assertions-browser.log'],'remediation':'使用已解析 YAML 核对实际步骤/条件/命令及依赖顺序；把关键测试和视觉比较绑定为可执行验证而非注释标记；增加文件级删除/停用探针，确认对应 Gate 非零。'},
{'id':'M-01','severity':'中危','module':'tests/contract/fixtures/；contract.test.ts；handlers.ts','manifestation':'fixture目录缺少全量schema/用途/预期结果清单。command-center/default.json、stale.json未被契约测试和MSW resolver读取；实际向default注入字典明确禁止的venueApiKey后，13项contract、sabotage与PRE-06结构检查均退出0。生成62个operation和51个schema不等于62项有效成功fixture覆盖。','impact':'仓库内fixture可漂移或携带禁止字段而持续全绿，后续复用这些fixture缺少安全与schema保障；不要求本阶段实现全部provider。','evidence':['mutations.json','unused-fixture-contract.log','unused-fixture-sabotage.log','unused-fixture-pre06.log'],'remediation':'建立所有fixture清单：正向绑定当前schema，负向绑定预期错误，未使用/过期fixture明确退休或隔离；遍历检查敏感字段并验证所有MSW响应分支，未知fixture必须拒绝。'},
{'id':'M-02','severity':'中危','module':'scripts/check-perf-budget.mjs:39–61；frontend-baseline.yml:105–106','manifestation':'空pages、空_next目录且无JS/CSS时，性能脚本把三项指标计算成0并退出0。当前CI仅检查默认Terminal产物，官网未接入同一预算；逐路由预算只报告不阻断。','impact':'缺失/空产物可被记为性能通过，官网bundle回归无持续预算保护。本轮两应用真实构建均低于现有预算，不代表已有性能超限。','evidence':['probes.json','perf-terminal.log','perf-website.log'],'remediation':'拒绝空路由、空关键资源和不完整manifest，核对资源存在与构建身份；CI分别检查两应用。按计划冻结路由预算或明确后续基线化责任，不用零值替代缺证据。'},
{'id':'M-03','severity':'中危','module':'playwright.config.ts:19；playwright.website.config.ts:16','manifestation':'CI自动重试1次，未启用failOnFlakyTests或等价失败策略。继承两套配置的合成用例首次失败、retry=1通过；两个进程均退出0，JSON均记录flaky=1。','impact':'违反计划7.1“不得以重跑掩盖flaky”；偶发认证/权限/布局失败可能被绿色状态遮蔽。本轮正式浏览器重放显式retries=0，未观察到真实flaky。','evidence':['mutations.json','terminal-flaky.json','website-flaky.json'],'remediation':'CI设置failOnFlakyTests=true或关闭重试，保留首次失败证据；增加一失败一成功的政策负向用例并要求进程非零。'},
{'id':'M-04','severity':'中危','module':'tests/e2e/visual-baselines.json；默认Playwright三浏览器命令','manifestation':'17个登记PNG覆盖12/12 Linux、5/12 macOS视觉路径。当前macOS默认执行：Firefox 24通过3失败、WebKit25通过2失败，均因缺少7张macOS快照；Darwin完整性检查非零。当前不再跳过，旧总结的“有跳过PASS”不能沿用。','impact':'本机三浏览器完整重放失败，Mac上的Firefox/WebKit功能通过与完整视觉验收无法合并为PASS；未证明Linux当前运行失败。','evidence':['visual-darwin.log','terminal-firefox.json','terminal-webkit.json','terminal-firefox.log','terminal-webkit.log'],'remediation':'冻结支持的OS×浏览器矩阵并生成/评审必需平台基线；若仅支持Linux视觉，明确本机功能与视觉命令边界和NOT RUN状态。不得临时无条件skip、自动批准新图或把缺图记为PASS。'},
{'id':'M-05','severity':'中危','module':'vitest.coverage.config.ts:9–20；计划7.1关键风险分支标准','manifestation':'当前覆盖率只门禁全局lines≥80，未冻结关键风险分支清单或100%分支门槛；全部TSX排除。整体lines80.20%、branches76.15%仍通过，auth/flow分支75%、audit/gateway56%。这些汇总值不能证明某个具体交易不变量失败，但无法证明关键风险状态100%受控。','impact':'关键权限/风险/危险确认逻辑可缺少分支保护而总体覆盖率通过；已存在的功能用例不等同于可执行的关键分支验收。','evidence':['coverage-summary.json','web-coverage.log'],'remediation':'由风险/QA冻结当前已实现关键文件与分支映射并设独立100%门禁；纳入其中的TSX逻辑或抽取可测纯逻辑，保留全局80%门槛，不把全量未来页面实现纳入PRE-06。'},
{'id':'M-06','severity':'中危','module':'docs/PRE-06-summary.md:25–51；执行计划当前COMPLETED标记','manifestation':'总结虽已更新62operations/51schemas，但视觉数量仍5，性能仍138.8/58.1KB，Firefox/WebKit仍“跳过PASS”；实际17快照、139.4/58.5KB以及缺图FAIL。旧实测没有独立当前源码身份；计划状态COMPLETED不能替代本轮严格复核结果。历史2026-09-16回执本身不应改写。','impact':'读者会误判当前可重放状态、视觉覆盖和验收完成率，阶段放行依据不准确。','evidence':['pre06.log','perf-terminal.log','terminal-firefox.json','terminal-webkit.json'],'remediation':'将历史结果单独标记source SHA与日期，当前总结绑定新证据；按本轮缺陷修复后再确认完成状态，显式保留Linux/远端/正式G0边界。'},
{'id':'L-01','severity':'低危','module':'.github/workflows/frontend-baseline.yml；compatibility.yml:54–62','manifestation':'配置retain-on-failure，但Frontend Baseline未归档test-results/报告；Compatibility上传artifacts/browser JSON，未上传对应trace/失败图片。报告中的本地附件路径不会随JSON自动入库。','impact':'远端失败后排查与审计重放缺少trace/图片，特别是视觉差异与重试首次失败；现有日志仍可提供部分线索。','evidence':['commands.json'],'remediation':'为两套workflow加if:always()的报告、trace、expected/actual/diff归档及保留期，配置按应用/浏览器隔离输出，避免互相清理覆盖。'}]
controls=[
('C01','一期官网/Web Terminal及Desktop隔离','PASS','两个Web配置与workflow；deep-link忽略，Desktop仅手动'),
('C02','锁定工具链、依赖、测试命令和目录','PASS','干净Git副本，Node24.12.0/pnpm10.20.0冻结离线安装'),
('C03','同源OpenAPI/schema/MSW生成与漂移检查','PASS','1.3.0；62operations/51schemas；generated与coverage检查通过'),
('C04','MSW授权/错误/未配置操作语义','PASS','13contract；200/403/409/429/501与版本/限流通过，四resolver不是62个成功fixture'),
('C05','fixture集合可枚举、逐项schema与安全受检','FAIL','M-01：未使用fixture敏感注入仍放行'),
('C06','schema故意破坏必检出','PASS','缺required负向、Zod/Ajv及sabotage通过'),
('C07','冻结权限不变量故意破坏必检出','PASS','TradeProposal.executable=true拒绝；不推断全业务RBAC/provider验收'),
('C08','敏感字段负向扫描可靠','PARTIAL','H-01：venueApiKey检出，三种既有字典语义别名误放行'),
('C09','两应用三浏览器CI项目与隔离配置','PASS','六project、viewport1440x900、forbidOnly与失败trace接线存在'),
('C10','当前目标浏览器功能与视觉重放完整','PARTIAL','M-04：130/135通过，5视觉用例FAIL；Linux只检查基线未实际运行'),
('C11','axe严重/高等级违规阻断基线','PASS','官网七页、Command/Login/Settings扫描在本轮通过；不是全量WCAG2.2签署'),
('C12','390px、200%缩放及键盘基线','PASS','认证/设置缩放，小屏高风险隐藏与下载区域键盘用例通过'),
('C13','实际PNG inventory/hash/尺寸/0.5%阈值及破坏','PASS','17PNG完整性、Linux12/12路径及真实PNG篡改检出'),
('C14','页面像素比较断言可删除时必须被拒绝','FAIL','H-02：删除toHaveScreenshot仍27/27、sabotage和结构检查通过'),
('C15','两应用完整构建性能预算持续阻断','PARTIAL','M-02：真实产物通过，空产物放行且官网预算缺CI'),
('C16','CI真实步骤/关键测试删除负向保护','FAIL','H-02：if:false、注释标记及恒真contract未拒绝'),
('C17','CI不得用重试掩盖flaky','FAIL','M-03：继承两配置的flaky=1仍exit0'),
('C18','全局80%与关键风险分支100%验收机制','PARTIAL','M-05：80.20%全局通过；关键清单/分支门槛缺失，TSX排除'),
('C19','失败报告/trace/视觉附件可归档','PARTIAL','L-01：runner本地留trace，CI附件归档不完整'),
('C20','总结/计划状态与当前验证身份一致','FAIL','M-06：视觉/性能/跨浏览器当前结果与总结不一致')]
counts={x:sum(r[2]==x for r in controls) for x in ['PASS','PARTIAL','FAIL']};pct=counts['PASS']/len(controls)*100
(f/'issue-ledger.json').write_text(json.dumps({'total':len(issues),'severities':{'blocker':0,'high':2,'medium':6,'low':1},'issues':[dict(x,status='OPEN') for x in issues]},ensure_ascii=False,indent=2)+'\n')
(f/'task-matrix.json').write_text(json.dumps({'total':len(controls),'status_counts':counts,'strict_completion_percent':pct,'formula':'PASS / total; PARTIAL receives no credit','controls':[dict(zip(['id','requirement','status','verification'],r)) for r in controls]},ensure_ascii=False,indent=2)+'\n')
report='''# P0 / PRE-06「测试基线」全面复审报告

> 日期：2026-10-02；源码基线：`cb729db7497b25b0e6e1a6a02a4699287ae8172e`；执行计划 v3.10。
> 结论：**CHANGES_REQUESTED（仓库范围）**。20 项控制点中 PASS 10、PARTIAL 5、FAIL 5，严格完成率 **50.00%**。发现 0 个阻塞级、2 个高危、6 个中危、1 个低危问题。

## 一、任务完成概况

执行计划 PRE-06 要求建立 MSW contract fixtures、Playwright project、axe、视觉基线、性能预算，交付测试目录与 CI job，并保证故意破坏 schema、权限、敏感字段或视觉基线能使 CI 失败。本次以该任务及计划 §7.1/§7.4 为依据，对已有基线、可破坏门禁与真实执行链复审；后续页面全量实现、provider/staging、交易旅程和正式 G0 不提前计为本任务缺陷或通过。

测试目录、两套三浏览器 project、axe、17 个视觉PNG、性能脚本与 Web CI 已存在。正向Gate及四类既定破坏样例通过，但独立负向探针证明敏感别名、fixture集合、CI停用/断言删除、空产物与flaky策略仍可误放行。计划的 `COMPLETED` 仅是当前开发标记，本次不能确认其达到严格验收完成标准。

**统计口径：**20 个等权控制点均由需求、规范或本任务验收机制拆解；只计完整 PASS，PARTIAL 不计分，完成率为 `10 / 20 × 100% = 50.00%`。三类原始状态全部保留，不能用测试用例通过率替代任务完成率。两项要求产出中，测试目录已交付、CI job已建立但阻断机制部分完成；这不是对源码行数或五类工具分别估算的进度。

**执行身份：**初始工作区干净；当前Git提交导出至新临时目录，冻结lockfile、使用宿主离线缓存安装。Node24.12.0/pnpm10.20.0，macOS本地静态服务，显式CI mock公开配置。浏览器正式重放使用 `--retries=0`；另用专门合成探针验证CI重试政策。所有破坏只在临时副本执行并恢复，未修改工程实现、测试或执行计划，未操作数据库。没有真实秘密、真实账号、部署或发布。

证据：[主命令与退出码](./evidence/pre06-review-20261002/commands.json)、[独立探针](./evidence/pre06-review-20261002/probes.json)、[文件级破坏](./evidence/pre06-review-20261002/mutations.json)、[任务矩阵](./evidence/pre06-review-20261002/task-matrix.json)、[问题台账](./evidence/pre06-review-20261002/issue-ledger.json)、[源码及证据哈希](./evidence/pre06-review-20261002/manifest.json)。[2026-09-16历史回执](./PRE-06-acceptance-evidence-2026-09-16.md)保留原身份，不用来证明当前提交已通过。

## 二、完成情况明细统计

| 控制点 | 验收要求 | 当前核对结果 | 状态 |
|---|---|---|---|
'''
for id,req,status,evidence in controls:report+=f'| {id} | {req} | {evidence} | {status} |\n'
report+='''
### 本次实际执行结果

| 检查 | 结果及限制 |
|---|---|
| PRE-06正向 / 结构负向 | PASS / 7/7；正向报告62 operations、51 schemas、17视觉基线，但未覆盖本轮误放行 |
| contract / 四类sabotage | 13/13；schema、executable不变量、venueApiKey、真实PNG hash及pixel差异样例检出 |
| generated / BFF coverage / PRE-04 / PRE-05 | PASS；62操作生成与页面映射不是62操作成功fixture或provider执行覆盖 |
| lint / typecheck / workspace单元 | PASS；181/181、25测试文件 |
| Web覆盖率 | PASS现有lines80门槛；lines80.20%、branches76.15%，不证明关键分支100% |
| 两应用构建 | 2/2，CI公开配置；含PRE-05客户端产物扫描 |
| Terminal性能 | 共享JS139.4KB、最大chunk58.5KB、CSS10.7KB，现有预算通过 |
| 官网性能 | 共享JS139.4KB、最大chunk58.5KB、CSS4.4KB，现有预算通过；CI尚未接线 |
| PNG inventory / Linux完整路径 | PASS；17登记PNG；Linux12/12必需路径存在，非Linux运行回执 |
| macOS完整路径 | FAIL；缺7张PNG（Firefox4、WebKit3） |
| Terminal Chromium / Firefox / WebKit | 27/27；24通过3失败；25通过2失败。失败均缺平台快照，没有skip |
| 官网 Chromium / Firefox / WebKit | 各18/18 |
| 浏览器合计 | 130通过、5失败、0跳过、0flaky；130/135=96.30%，不等于任务完成率 |
| 14个独立拒绝断言 | 4正确拒绝、10误放行；包括既定schema/权限/敏感字段控制样例 |
| 11个文件级/重试破坏进程 | 全部exit0，均为本轮预期拒绝而误放行；见具体作用链，非完整远端workflow验收 |

当前PNG已支持Linux完整矩阵，历史总结的“Linux缺失”边界也不能继续当作当前事实。本次没有Linux runner，因此Linux实际像素/浏览器执行仍 **NOT RUN / NO RECEIPT**。本机缺快照失败时Playwright会向临时快照目录写入收到的图片；独立破坏探针前删除未登记生成图片，恢复干净登记集合，避免无关inventory失败遮蔽误放行。首轮受生成快照干扰的探针日志原样保存在 `mutation-attempt-1`，最终结论采用清理后重跑结果。

## 三、问题清单及风险分析

| 优先级 | 数量 | 当前状态 |
|---|---:|---|
| 阻塞级 | 0 | 无构建或基础工具完全不可用问题 |
| 高危 | 2 | 全部OPEN，影响敏感数据和完成标准阻断可信度 |
| 中危 | 6 | 全部OPEN，影响fixture、性能、稳定性、平台复现及验收口径 |
| 低危 | 1 | OPEN，影响失败证据可追溯性 |

'''
for x in issues:
 report+=f'''### {x['id']} · {x['severity']} · {x['module'].split('；')[0]}

- **所属模块：**{x['module']}。
- **具体表现：**{x['manifestation']}
- **影响范围：**{x['impact']}
- **证据：**'''+', '.join(f'[{name}](./evidence/pre06-review-20261002/{name})' for name in x['evidence'])+'。\n\n'
report+='''schema缺字段、TradeProposal不可执行和原始venueApiKey样例的门禁有效，真实PNG篡改也可被检出；风险在于这些样例不能覆盖等价别名、全部fixture和实际测试/CI接线退化。没有证据表明真实秘密已泄露或线上权限已绕过，也没有证据证明现有两应用bundle超预算。

真实staging、BFF/IdP/Sentry/provider、数据库执行、完整业务旅程、Linux当前CI、正式G0、指定模型复审和Desktop/native仍需各自绑定提交的目标回执。本报告不将它们算作本轮已通过，也不把后续业务实现工作提前列为PRE-06修复范围。

## 四、整改建议

按高危先行，再完善持续回归与文档。每项修复应附原问题探针修复前/后结果，不能只增加测试数量或改写PASS说明。

| 顺序 | 问题 | 建议负责人 | 修复与复验要求 |
|---|---|---|---|
'''
for idx,x in enumerate(issues,1):
 owner='Security + QA' if x['id']=='H-01' else 'Frontend + QA'
 report+=f"| {idx} | {x['id']} | {owner}（建议，非指派） | {x['remediation']} |\n"
report+='''
完成修复后，先重放本次14个独立断言和11个文件级/策略探针，按预期拒绝/允许逐项核对；再运行配置/契约/视觉正负Gate、两应用构建与性能、既定三浏览器矩阵、类型/静态/单元与关键分支覆盖。为支持的目标平台保留实际截图与trace，并绑定精确源码、工具链、构建配置及环境；正式远端CI另取回执。

最后同步PRE-06总结和执行计划，保留历史验收记录，按相同20项矩阵重新计算完成率。高危关闭且当前必要验证完成后，才建议将本次审查结论更新为PASS；本轮仅做复审和报告归档，不实施上述修复。
'''
(root/'docs/audit/PRE-06-comprehensive-review-2026-10-02.md').write_text(report)
print(counts,pct,'issues',len(issues))
