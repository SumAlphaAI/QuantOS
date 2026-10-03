from pathlib import Path
import json
import hashlib
import subprocess

f = Path(__file__).resolve().parent
r = f.parents[3]
c = json.loads((f / "commands.json").read_text())
w = Path(c["workspace"])


def read(p):
    return json.loads(p.read_text())


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write(p, v):
    p.write_text(json.dumps(v, ensure_ascii=False, indent=2) + "\n")


assert len(c["results"]) == 39 and all(v["exit_code"] == 0 for v in c["results"])
cp = read(f / "checkpoint-probes.json")
assert cp["f06"]["status"] == "FAIL" and cp["f06"]["noteState"] == "MISSING_LOCAL_REF"
assert len(cp["results"]) == 4 and all(
    v["structural_result"] == "PASS" for v in cp["results"]
)
mutation = read(f / "contract-return-probe.json")
assert all(v["unexpected_accept"] for v in mutation["results"])
browser = {
    a + "-" + b: read(f / (a + "-" + b + ".json"))["stats"]
    for a in ["terminal", "website"]
    for b in ["chromium", "firefox", "webkit"]
}
assert sum(v["expected"] for v in browser.values()) == 135 and all(
    v[k] == 0 for v in browser.values() for k in ["unexpected", "skipped", "flaky"]
)
assert read(f / "browser.json")["status"] == "PASS"
coverage = read(f / "coverage-summary.json")["total"]
critical = read(f / "critical-coverage-summary.json")
assert all(
    v[k]["pct"] == 100
    for v in critical.values()
    for k in ["lines", "statements", "functions", "branches"]
)
seconds = round(sum(v["seconds"] for v in c["results"]), 3)
issues = [
    {
        "id": "B-01",
        "severity": "阻塞级",
        "module": "PRE-04 → CORE:F06 跨任务前置验收",
        "source": [
            "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md:164",
            "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md:239",
            "docs/SumAlpha-QuantOS-Development-Plan.md:362",
            "scripts/check-f06-acceptance.mjs:33",
        ],
        "manifestation": "PRE-04明确依赖完整CORE:F06，计划禁止将CORE前置解释为仅服务/本地契约。F06状态解释要求任一新HEAD绑定同SHA目标回执。本地refs/notes/f06-acceptance未提供当前4433f1e完整SHA回执；直接调用现有验收判定器返回FAIL：F06 target acceptance receipt is missing or invalid。",
        "impact": "PRE-04的接口盘点工程产出仍可通过，但不能据此认定完整前置已接受，因而不能关闭P0并放行A1。未认定F06实现失败，也未断言远端从未执行。",
        "evidence": ["checkpoint-probes.json"],
        "recommendation": "先核对并获取/同步与被验收完整SHA一致的可信F06目标回执；确无回执则在已配置Supabase目标上按现行F06规程完成验收。由负责方校验来源、三类目标检查和全部关闭项，干净工作树运行make f06-acceptance-gate。若希望改变前置范围，须显式修订依赖与验收政策，不自行降级CORE:F06。",
        "owner": "Auth/Security owner + F06验收负责人",
        "status": "OPEN",
    },
    {
        "id": "H-01",
        "severity": "高危",
        "module": "PRE-06 契约断言实际执行保障",
        "source": [
            "scripts/pre06-test-structure.mjs:58",
            "tests/contract/contract.test.ts:32",
        ],
        "manifestation": "契约检查仍按回调AST中存在expect和目标调用判断执行。在干净副本中向8个requiredContractTests回调首部插入return，保留所有名称与断言后，check:pre06、test:contract和sabotage:pre06全部退出0；Vitest仍报告17项通过。视觉断言已有直接await/提前return保护，契约路径未获得同等保障。",
        "impact": "schema、权限、敏感字段、501/409/429及集合/别名回归可整体停止执行而继续全绿，P0要求测试基线可靠的完成条件未完全满足。不是实际生产泄露或所有安全校验失效；独立fixture校验仍在执行。",
        "evidence": [
            "contract-return-probe.json",
            "contract-return-check-pre06.log",
            "contract-return-test-contract.log",
            "contract-return-sabotage-pre06.log",
        ],
        "recommendation": "对关键契约回调增加实际断言执行保障（例如由统一setup/beforeEach强制expect.hasAssertions/assertions，并取得不可绕过的运行回执），补充提前return、条件死分支、未调用helper和零断言负向测试；确保结构、契约及CI相关入口均非零。修复后再更新PRE-06关闭结论和P0联合回执。",
        "owner": "Frontend TL + QA",
        "status": "OPEN",
    },
    {
        "id": "M-01",
        "severity": "中危",
        "module": "PREPARATION:P0 验收记录与放行依据",
        "source": [
            "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md:225",
            "scripts/check-development-plan-order.mjs:22",
            "scripts/check-development-plan-order.mjs:40",
        ],
        "manifestation": "P0登记仍为NOT_STARTED、source_commit=null、evidence=[]，尚无可接受的阶段放行记录。现有check:development-plans明确只验证静态排期：合成ACCEPTED配伪造SHA/无关文档、失效HTTPS、FAIL回执，甚至PRE-01未完成时都能得到structure PASS。未发现另一个P0实际回执验收入口。",
        "impact": "静态图正确、各PRE历史报告和本轮本地绿灯无法单独证明P0被正式关闭。当前NOT_STARTED是正确的未放行状态；风险在于未来把结构PASS或COMPLETED当作授权。此项是待补验收交付，不把静态校验器违反其自身声明当作代码缺陷。",
        "evidence": ["checkpoint-probes.json", "plans.log", "commands.json"],
        "recommendation": "在B-01/H-01关闭后生成P0专项验收记录，列出六PRE证据、核心前置、完整SHA、摘要、环境、逐项结论、审核责任角色及仅放行A1的边界；按流程登记ACCEPTED/source_commit/evidence。提供独立可重放校验或明确人工核验步骤，拒绝旧SHA、失败/缺项/不可访问回执与未完成依赖；保持排期结构检查的职责清晰。",
        "owner": "Frontend TL + QA + P0检查点负责人",
        "status": "OPEN",
    },
]
controls = [
    (
        "C01",
        "P0范围、六项依赖与A1/G0/provider边界",
        "PASS",
        "计划依赖图、35个检查点/157节点/1454边通过；只放行A1",
        "plans.log; plan-negative.log; g0-boundary.log",
    ),
    (
        "C02",
        "PRE-03/PRE-04的完整核心前置可接受",
        "FAIL",
        "F01/F03已有范围化历史接受记录；当前SHA的F06目标回执本地缺失，判定FAIL（B-01）",
        "checkpoint-probes.json",
    ),
    (
        "C03",
        "PRE-01页面、Story及七态覆盖100%",
        "PASS",
        "30页面、124页面Story+8流程Story、210七态+10流程场景、30追踪行",
        "pre01.log; pre01-negative.log",
    ),
    (
        "C04",
        "角色/路由/风险/离线与安全要求一致",
        "PASS",
        "受控规则、operation追踪及32项正负回归通过",
        "pre01-negative.log",
    ),
    (
        "C05",
        "PRE-02设计台账、基础WCAG与安全i18n",
        "PASS",
        "252对比度配对、18安全key、19通用/25领域条目、7基础Story；27回归及4组实际Chromium基础检查通过",
        "pre02.log; pre02-negative.log; browser.json; storybook.log",
    ),
    (
        "C06",
        "PRE-03依赖落地、锁定与双应用PoC",
        "PASS",
        "29关键依赖、2349运行时契约检查、2目标路由；Web正负27项与构建通过",
        "pre03.log; pre03-negative.log; node-lock.log",
    ),
    (
        "C07",
        "新源码bootstrap/build/test在30分钟内",
        "PASS",
        f"干净Git导出、宿主离线下载缓存；包含构建与测试的39项主检查累计{seconds}秒；非无缓存联网计时",
        "commands.json",
    ),
    (
        "C08",
        "PRE-04接口/字段/页面依赖完整",
        "PASS",
        "17契约、23个P0单元、383字段；62已发布/46计划能力区分，38回归通过",
        "pre04.log; pre04-negative.log; generated.log; contract-coverage.log",
    ),
    (
        "C09",
        "owner及mock状态可追溯",
        "PASS",
        "17契约均有BFF/领域责任角色，实施任务及生成mock/规划inventory/本地provider边界明确；不冒充个人签字",
        "pre04.log; pre04-negative.log",
    ),
    (
        "C10",
        "PRE-05三环境配置、身份与mode分离",
        "PASS",
        "三profile正向、26配置测试+10门禁回归通过；真实账号/服务未执行",
        "pre05.log; pre05-negative.log",
    ),
    (
        "C11",
        "缺配置fail-fast与客户端秘密检查",
        "PASS",
        "PRE05负向通过；当前两应用mock构建及客户端产物扫描通过",
        "pre05-negative.log; client-secrets.log",
    ),
    (
        "C12",
        "PRE-06同源schema/MSW、敏感字段与fixture台账",
        "PASS",
        "62操作/51schema；10项fixture、17正常contract、schema/权限/敏感字段原有破坏检查通过",
        "contract.log; sabotage.log; generated.log",
    ),
    (
        "C13",
        "关键负向测试确实执行且停用必拒绝",
        "PARTIAL",
        "既有16门禁回归通过；8个关键contract提前返回后3个入口仍PASS（H-01）",
        "pre06-negative.log; contract-return-probe.json",
    ),
    (
        "C14",
        "当前目标浏览器、基础axe与视觉基线",
        "PASS",
        "macOS六组135/135、无失败/跳过/flaky；24PNG完整；Linux执行另需回执",
        "terminal-chromium.json; terminal-firefox.json; terminal-webkit.json; website-chromium.json; website-firefox.json; website-webkit.json; visual-inventory.log",
    ),
    (
        "C15",
        "覆盖率、性能预算与CI失败证据接线",
        "PASS",
        f"全局行{coverage['lines']['pct']}%；5关键文件四维100%；两应用预算通过；CI报告/trace保留政策受检",
        "web-coverage.log; critical-coverage-summary.json; perf-terminal.log; perf-website.log; pre06-negative.log",
    ),
    (
        "C16",
        "P0完整SHA验收记录和受限放行闭环",
        "FAIL",
        "NOT_STARTED/null/[]；缺实际放行记录，结构检查不验证回执有效性（M-01）",
        "checkpoint-probes.json",
    ),
]
assert len(controls) == 16
counts = {s: sum(v[2] == s for v in controls) for s in ["PASS", "PARTIAL", "FAIL"]}
assert counts == {"PASS": 13, "PARTIAL": 1, "FAIL": 2}
write(
    f / "task-matrix.json",
    {
        "total": 16,
        "counts": counts,
        "strict_completion_percent": 81.25,
        "formula": "PASS / 16; PARTIAL has no credit; completion percentage never overrides blocker",
        "controls": [
            dict(zip(["id", "requirement", "status", "verification", "evidence"], v))
            for v in controls
        ],
    },
)
write(
    f / "issue-ledger.json",
    {
        "total": 3,
        "severities": {"blocker": 1, "high": 1, "medium": 1, "low": 0},
        "issues": issues,
    },
)
paths = filter(
    None, subprocess.check_output(["git", "ls-files", "-z"], cwd=r).decode().split("\0")
)
inputs = {}
for name in paths:
    if name.startswith(
        (
            "apps/",
            "packages/",
            "scripts/",
            "tests/",
            ".github/workflows/",
            "env/",
            "docs/PRE-",
            "docs/gate-records/",
            "docs/adr/20260814-pre",
        )
    ) or name in [
        "AGENTS.md",
        "Makefile",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "playwright.config.ts",
        "playwright.website.config.ts",
        "vitest.config.ts",
        "vitest.coverage.config.ts",
        "vitest.critical.config.ts",
        "eslint.config.mjs",
        "tsconfig.base.json",
        "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md",
        "docs/SumAlpha-QuantOS-Development-Plan.md",
        "docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md",
        "docs/SumAlpha-QuantOS-Web-and-Terminal-Design.md",
        "docs/audit/F06-closed-findings-2026-09-25.md",
    ]:
        p = r / name
        if p.is_file():
            assert p.read_bytes() == (w / name).read_bytes(), name
            inputs[name] = sha(p)
baseurl = "./evidence/p0-preparation-review-20261002/"


def links(names):
    return "、".join("[" + n + "](" + baseurl + n + ")" for n in names)


ct = "\n".join(
    "| " + v[0] + " | " + v[1] + " | " + v[3] + " | " + v[2] + " |" for v in controls
)
it = "\n".join(
    "| "
    + v["id"]
    + " | "
    + v["severity"]
    + " | "
    + v["module"]
    + " | "
    + v["impact"]
    + " |"
    for v in issues
)
sections = "\n\n".join(
    "### "
    + v["id"]
    + " · "
    + v["severity"]
    + " · "
    + v["module"]
    + "\n\n**具体表现：**"
    + v["manifestation"]
    + "\n\n**影响范围：**"
    + v["impact"]
    + "\n\n**定位：**"
    + "；".join("`" + p + "`" for p in v["source"])
    + "。证据："
    + links(v["evidence"])
    + "。"
    for v in issues
)
fixes = "\n".join(
    "| "
    + str(i + 1)
    + " | "
    + v["id"]
    + " | "
    + v["owner"]
    + " | "
    + v["recommendation"]
    + " |"
    for i, v in enumerate(issues)
)
report = r / "docs/audit/PREPARATION-P0-comprehensive-review-2026-10-02.md"
report.write_text(f"""# P0 / PREPARATION:P0 验收检查点全面复审报告

> 日期：2026-10-02（Asia/Shanghai）；计划版本：3.12；检查提交：`{c["baseline"]}`。
> 结论：**CHANGES_REQUESTED，当前不满足A1准入；存在1项阻塞级问题。**
> 严格完成率：**13/16＝81.25%**；PASS13、PARTIAL1、FAIL2。问题共3项：阻塞1、高危1、中危1、低危0。

## 一、任务完成概况

依据[前端执行计划3.1与P0检查点](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-preparation-p0)、[核心计划](../SumAlpha-QuantOS-Development-Plan.md)、[Terminal规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)、[网站与终端设计](../SumAlpha-QuantOS-Web-and-Terminal-Design.md)，核对六PRE产物、完整前置、owner/环境/mock/设计/接口台账、测试基线及A1放行记录。

PRE-01至PRE-06的准备产物均已入库。当前提交的39项联合正向/既有负向检查全部通过，另有2项补充静态检查和4组基础浏览器检查通过；这些结果能够证明较完整的本地工程准备，但不能直接关闭阶段检查点。独立复核发现：当前SHA的必需F06回执不可得；关键契约测试可提前返回而继续全绿；P0完整SHA放行记录尚未形成。

**范围口径：**P0只准备并放行A1，不要求此时完成正式G0、全部OpenAPI/provider、全页面七态运行或Desktop。六项任务的历史“100%”属于各自范围与提交，不能取平均当作检查点完成率。接口owner按仓库约定核对责任角色，不把角色台账当作个人签署。

**执行身份：**开始时工作区干净；从上述提交导出新源码副本，Node24.12.0/pnpm10.20.0、冻结离线安装，使用宿主现有下载缓存及显式CI mock公开配置。主链累计{seconds}秒，符合该条件下30分钟要求；不声称验证了无缓存联网下载耗时。浏览器实际运行于macOS，六组使用retries0和update-snapshots=none。全部变异仅在副本或内存进行并恢复；未修改实现、执行计划或验收状态，未连接数据库。

**证据：**{links(["commands.json", "supplemental.json", "browser.json", "task-matrix.json", "issue-ledger.json", "checkpoint-probes.json", "contract-return-probe.json", "manifest.json"])}。Linux执行、远端CI、目标服务/数据库、正式G0及指定模型/owner签署未在本轮执行；只有F06属于计划明确继承的完整前置，其当前回执缺口按阻塞项记录，其余后续范围不计作P0缺陷。

## 二、完成情况明细统计

按P0要求拆为16个等权、可核对控制点，PASS计1，PARTIAL/FAIL计0；缺核心前置与缺放行记录各单独计项，未按测试数量或文件数推算完成率。任何阻塞项未关闭，即使百分比提高也不能放行。

| 编号 | 验收要求 | 当前核对结果 | 状态 |
|---|---|---|---|
{ct}

### 六项准备任务交付概况

| 工作包 | 当前工程交付复核 | 验证与范围 |
|---|---|---|
| PRE-01 需求拆解 | PASS | 30页、132 Story、220场景、30行追踪；32回归；规划覆盖不冒充页面运行 |
| PRE-02 设计系统 | PASS | 252对比度配对、18安全文案；27回归；Storybook构建、四组深浅主题/中英文基础浏览器验证 |
| PRE-03 技术栈 | PASS | 29关键依赖；双应用构建/路由、27正负测试、启动链时限通过；不重新签署整个F01 |
| PRE-04 接口盘点 | PASS（工程产物） | 17契约/383字段/23个P0单元；62已发布和46计划能力明确；完整F06前置另见B-01 |
| PRE-05 环境方案 | PASS | 三模板配置、26+10回归及当前mock两应用产物秘密扫描；未接真实staging/身份服务 |
| PRE-06 测试基线 | PARTIAL | 原16回归、contract17/17、六组浏览器通过；8个关键回调提前return的变异仍误放行 |

上表只反映工程交付：6/6工作包有产物，5项完整通过、1项部分通过；阶段依赖与最终放行按16项矩阵计算，避免将“有产物”混同“已接受”。

### 当前执行统计

| 项目 | 本轮结果 |
|---|---|
| 主命令 | 39/39退出0；补充G0边界/Node锁2/2退出0 |
| 六PRE回归 | PRE01 32；PRE02 27；PRE03 27；PRE04 38；PRE05 26+10；PRE06 16；均通过 |
| 工作区/契约/计划 | 单元187项；正常contract17项；计划回归22项；lint/typecheck/生成检查通过 |
| 浏览器 | Terminal81+官网54＝135/135，失败/跳过/flaky均0；另4组PRE02基础检查0 serious/critical |
| 覆盖率 | 全局行{coverage["lines"]["pct"]}%；5关键文件111/111行、126/126语句、27/27函数、98/98分支，各文件四维100% |
| 性能 | 两应用共享JS139.4KB、最大chunk58.5KB；Terminal CSS10.7KB/官网4.4KB；最大路由167.1KB/141.7KB，均低于冻结预算 |
| 视觉 | 24PNG完整，Linux/macOS各12；本轮只执行macOS浏览器 |
| 独立反证 | 8个关键contract回调不执行，3个入口仍exit0；4种无效接受记录仍获结构PASS；F06现有验收判定器因缺回执返回FAIL |

本轮没有重跑三profile×双应用的全部构建，也没有执行真实provider；三profile范围由当前模板校验与配置负向测试证明，构建证据仅对应本轮显式mock配置。

## 三、问题清单及风险分析

| 编号 | 优先级 | 所属模块 | 影响范围 |
|---|---|---|---|
{it}

{sections}

**综合风险：**B-01使完整依赖链未闭合；H-01使部分关键负向用例的绿灯不可靠；M-01使最终放行缺少可核验记录。现有NOT_STARTED没有错误授权A1，本轮也未发现真实数据泄露、交易执行或生产事故。现有计划静态检查明确声明只校验排期，四项结构PASS不能被描述为“真实验收通过”。

## 四、整改建议

按阻塞→高危→中危顺序处理；建议责任角色仅用于整改路由，不代表已联系或重新指派人员。

| 顺序 | 问题 | 建议责任角色 | 修复与验收要求 |
|---|---|---|---|
{fixes}

修复后固定最终完整SHA，重放六PRE联合检查及本报告反证，再形成P0专项回执、更新checkpoint状态与证据链接。A1准入仅在完整前置、可靠基线与阶段记录全部通过后生效。无需为P0提前实现全部planned API、补齐未来页面或启动本地数据库。
""")
manifest = {
    "schema": "quantos-p0-preparation-review/v1",
    "date": "2026-10-02",
    "source_commit": c["baseline"],
    "plan_version": "3.12",
    "result": "CHANGES_REQUESTED",
    "a1_admission": "NOT_ACCEPTED",
    "counts": counts,
    "strict_completion_percent": 81.25,
    "severities": {"blocker": 1, "high": 1, "medium": 1, "low": 0},
    "validation": {
        "main_commands": 39,
        "main_passed": 39,
        "supplemental_static_passed": 2,
        "foundation_browser_cases": 4,
        "browser_stats": browser,
        "unit_tests": 187,
        "contract_tests": 17,
        "pre_regressions": {
            "PRE01": 32,
            "PRE02": 27,
            "PRE03": 27,
            "PRE04": 38,
            "PRE05": 36,
            "PRE06": 16,
        },
        "main_elapsed_seconds": seconds,
        "coverage": coverage,
        "critical": critical["total"],
        "contract_callback_mutations": 8,
        "unexpected_accepting_processes": 3,
        "structural_only_invalid_receipt_probes": 4,
        "f06_current_sha_receipt": "MISSING_LOCAL_REF",
    },
    "binding": "pristine Git archive; all recorded tracked inputs byte-identical to root and restored audit workspace; synthetic mutations restored; no database or remote target execution",
    "input_sha256": dict(sorted(inputs.items())),
    "report_sha256": sha(report),
}
manifest["artifact_sha256"] = {
    str(p.relative_to(f)): sha(p)
    for p in sorted(f.rglob("*"))
    if p.is_file() and p.name != "manifest.json"
}
write(f / "manifest.json", manifest)
print("report saved;", len(inputs), "source bindings;", counts, "completion 81.25%")
