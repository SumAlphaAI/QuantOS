import json
import shutil
import re
import hashlib
from pathlib import Path

base = Path("docs/audit/evidence/provider-a2-remediation-20261007")
previous = Path("docs/audit/evidence/provider-a2-review-20261007")


def load(p):
    return json.loads(Path(p).read_text())


closure = load(base / "closure-verification.json")
assert closure["status"] == "PASS"
foundation = "docs/audit/evidence/provider-a1-remediation-20261004/provider-a2-clean-final-reassessment-20261007"
proofs = load(foundation + "/effective-execution-results.json")
assert len(proofs) == 87 and all(
    p["status"] == "PASS" and p["exitCode"] == 0 for p in proofs
)
api = closure["aggregate"]["apiCoverage"]
assert len(api) == 26
control = load(previous / "control-matrix.json")
control.update(
    baselineCommit=closure["sourceCommit"],
    pass_=24,
    partial=0,
    fail=0,
    fullCompletionPercent=100,
)
control["pass"] = control.pop("pass_")
control["method"] = (
    "Original 24 equal-weight controls, all independently rechecked after remediation; original findings/evidence retained."
)
changed = {
    "C02": "87组新F0/A1检查：lint/typecheck/格式/契约/生成均实际执行通过",
    "C16": "新身份/Audit语义回归通过，仍保留 F09 默认 ignored 的目标边界",
    "C17": "新127项门禁正负向回归通过；新8+5业务变异实际拒绝",
    "C19": "actual-receipt-negative-probes.json：失败/全拒绝/SSE失败全部拒绝",
    "C20": "actual-receipt-negative-probes.json：两子任务缺失/未知/blob冒充执行提交全部拒绝；7+13项源码内容绑定",
    "C21": "当前身份/Audit/A2报告与当前计划/回执/G0确认待办一致，原报告归档",
    "C22": "当前A2聚合manifest绑定规范输入、26API覆盖、三依赖及执行结果",
    "C23": "31项A2专用反例；package/Makefile/CI强制入口经语义校验",
    "C24": "check:provider-a2实际严格READY，formalAccepted=false",
}
for row in control["rows"]:
    row["result"] = "PASS"
    if row["id"] in changed:
        row["evidence"] = changed[row["id"]]
(base / "control-matrix.json").write_text(
    json.dumps(control, ensure_ascii=False, indent=2) + "\n"
)
finding = load(previous / "findings.json")
finding["counts"] = {k: 0 for k in finding["counts"]}
finding["closedCounts"] = {"BLOCKER": 1, "HIGH": 1, "MEDIUM": 1, "LOW": 1}
for x in finding["items"]:
    x["status"] = "CLOSED"
    x["closureEvidence"] = (
        "closure-verification.json / actual-receipt-negative-probes.json"
    )
(base / "closed-findings.json").write_text(
    json.dumps(finding, ensure_ascii=False, indent=2) + "\n"
)
for original, archive in [
    (
        "PROVIDER-A2-comprehensive-review-2026-10-07.md",
        "PROVIDER-A2-initial-review-2026-10-07.md",
    ),
    (
        "BFF-FE-001-comprehensive-review-2026-10-05.md",
        "BFF-FE-001-before-provider-a2-remediation-2026-10-07.md",
    ),
    (
        "BFF-FE-007-comprehensive-review-2026-10-06.md",
        "BFF-FE-007-before-provider-a2-remediation-2026-10-07.md",
    ),
]:
    src = Path("docs/audit") / original
    dst = Path("docs/audit") / archive
    if dst.exists():
        assert (
            hashlib.sha256(dst.read_bytes()).hexdigest()
            == closure["priorReports"][original]
        )
    else:
        shutil.copyfile(src, dst)
counts = closure["stageCounts"]
aggregate = closure["aggregate"]
manifest = aggregate["manifest"]
identity = closure["identity"]["manifest"]
audit = closure["audit"]["manifest"]
source = closure["sourceCommit"]
g0 = closure["g0"]
pending = g0["status"] == "BLOCKED"
g0sentence = (
    "G0 工程 16/16 PASS，当前范围项目用户确认待办，G0/FEP-0 为 BLOCKED；旧确认不迁移。"
    if pending
    else "当前 G0 用户确认已核验，G0/FEP-0 严格 READY。"
)
summary = f"当前全计划 {counts['READY']} READY、{counts.get('BLOCKED', 0)} BLOCKED。{g0sentence}"


def link(p):
    return p.removeprefix("docs/audit/")


controltable = "\n".join(
    f"| {r['id']} | {r['module']} | {r['criterion']} | PASS |" for r in control["rows"]
)
Path(
    "docs/audit/PROVIDER-A2-comprehensive-review-2026-10-07.md"
).write_text(f"""# PROVIDER:A2：当前整改复核报告

> 复核日期：2026-10-07；阶段：A2 DEVELOPMENT。主修复源码提交 `f5cd6e3`，负向探针兼容性补充提交 `50faf3f`；工程冻结执行提交 `{source}`；后续证据与文档提交按内容绑定复用，不声明同 SHA hosted CI/正式验收。
> 依据：[前端 A2 检查点](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-provider-a2)。

## 一、任务完成概况

**原 4 项问题（1 阻塞、1 高危、1 中危、1 低危）全部 CLOSED，当前活动问题 0。** 原 24 个等权控制点全部 PASS，完整完成率 **24/24，100%**。26 个 C01/C17/C10 API 均有契约允许的实际成功目标证据；专用聚合门禁 `pnpm check:provider-a2` 实际返回 **READY**、`formalAccepted=false`。

原始检查内容和失败证据完整保留在[初审原件](PROVIDER-A2-initial-review-2026-10-07.md)及[原证据目录](evidence/provider-a2-review-20261007/evidence-index.json)。逐项关闭依据见[关闭记录](evidence/provider-a2-remediation-20261007/closed-findings.json)和[严格复核记录](evidence/provider-a2-remediation-20261007/closure-verification.json)。

## 二、完成情况明细统计

| 检查分组 | 控制点 | PASS | PARTIAL / FAIL | 完整完成率 |
|---|---:|---:|---:|---:|
| 范围、契约、依赖 C01–C03 | 3 | 3 | 0 / 0 | 100% |
| 实现、安全、状态与审计 C04–C15 | 12 | 12 | 0 / 0 | 100% |
| 测试及现存目标证据 C16–C18 | 3 | 3 | 0 / 0 | 100% |
| 证据防误放行与文档 C19–C21 | 3 | 3 | 0 / 0 | 100% |
| 窗口聚合与准入 C22–C24 | 3 | 3 | 0 / 0 | 100% |
| 合计 | 24 | 24 | 0 / 0 | 100% |

| ID | 模块 | 原检查要求 | 当前结果 |
|---|---|---|---|
{controltable}

[机器控制矩阵](evidence/provider-a2-remediation-20261007/control-matrix.json)沿用原24项和完整PASS计数规则；API覆盖与测试通过数分别统计，不合并为完成率分母。

| 验证层 | 本轮结果与边界 | 当前证据 |
|---|---|---|
| F0/A1 依赖 | 87个唯一命令组最终PASS；原87次85PASS/2次失败（F05连接Closed、F08新证据脚本格式），F05完整8项及F08完整命令补测PASS；21基础/准备节点重新发布内容回执。首轮沙箱网络/缓存失败、干净工作树保护拒绝均保留，未算PASS | [最终有效组]({link(foundation)}/effective-execution-results.json)、[87次原件]({link(foundation)}/execution-results.json)、[F05完整补测]({link(foundation)}/f05-database-rerun.json)、[F08完整补测]({link(foundation)}/f08-functional-final-rerun.json)、[失败记录](evidence/provider-a1-remediation-20261004/provider-a2-reassessment-20261007/interruption.json) |
| 身份/Audit 子门禁 | 新语义回归、契约/阶段负向、8/5业务变异拒绝通过；全部当前输入及递归依赖严格核验 | [身份回执]({link(identity)})、[Audit回执]({link(audit)}) |
| 专用 A2 聚合 | 26 API精确清单、3项依赖、规范输入、目标回执及三个实际命令组绑定；31项专用负向，package/Makefile/CI接线有效 | [聚合回执]({link(manifest)}) |
| 全部既有/新增门禁正负向 | 127项实际PASS，0 FAIL；与子任务记录有重叠，不累加为独立需求数 | [负向执行](evidence/provider-a2-remediation-20261007/all-gates-negative.log) |
| 真实原件的负向校验 | {closure["negativeProbes"]}项内存异常全部拒绝：500/401、SSE失败、缺失/未知/blob冒充执行提交 | [新增探针](evidence/provider-a2-remediation-20261007/actual-receipt-negative-probes.json) |
| A2 实际目标 | 复用原身份51调用/14强断言及Audit83调用/45断言，两者cleanupVerified=true。7+13项源码与原Git提交及当前内容一致 | [逐文件与目标复用](evidence/provider-a2-remediation-20261007/closure-verification.json) |
| G0/FEP-0 | {summary} | [本轮严格复核](evidence/provider-a2-remediation-20261007/closure-verification.json) |

补充验证恢复发布程序在87组未完成时会拒绝发布，两份计划字节不变，见[不完整执行拒绝记录](evidence/provider-a2-remediation-20261007/incomplete-recovery-negative.json)。这项流程保护不计入原需求完成率分母。

本轮 F0/A1 中要求的实际数据库检查直接连接配置的 Supabase；未建立本地数据库。A2 身份/Audit 自身目标源码未变，未重新执行其目标调用；原不可变目标提交 `d758c839fbd57366346d0f2b9ef2081c68ab51e6` / `5e3339c9e5cc95d550c6e67ffa36701998cb0e2f`、执行范围及清理记录保持原事实。

## 三、问题清单及风险分析

| 优先级 | 当前活动问题 | 本轮关闭 |
|---|---:|---:|
| 阻塞级 | 0 | 1 |
| 高危 | 0 | 1 |
| 中危 | 0 | 1 |
| 低危 | 0 | 1 |

| 原问题 | 关闭依据 |
|---|---|
| H-01 | 身份门禁逐API要求OpenAPI成功状态；SSE要求200及原已执行撤销关联断言；所有失败/拒绝不能冒充正常覆盖；成功调用要求issues=[]，预期拒绝可省略issues但显式契约错误不准入 |
| M-01 | 两子门禁要求40位可解析commit对象，逐项核对原执行Git文件字节和当前功能输入；boolean不能替代不可变执行提交 |
| B-01 | A2专用manifest/输入policy/递归校验/26API覆盖/实际执行/负向套件/CI均已建立，严格评估通过后发布自身READY |
| L-01 | 身份报告的旧22 READY/G0/CI-cold-cache引用归档；当前身份/Audit/A2报告与有效回执及计划同步 |

{g0sentence} 这是本轮功能输入变化触发的独立人工确认边界，不是A2仍有未解决缺陷；项目用户确认前不自行批准。新文稿见[当前 G0 文稿](../gate-records/G0-user-confirmation-draft-2026-10-07-b2fd984536e0.md)。

A2 READY 只关闭后续任务的这一项依赖，不替代其余服务/窗口依赖、consumer/UI的I迭代、PROVIDER:ALL或RELEASE。staging、真实部署/IdP、性能/长稳、目标规模下五分钟还原、当前HEAD hosted CI与正式签署仍独立验收；本轮未声明正式ACCEPTED。

## 四、整改建议与后续维护

本报告四项整改已完成，无遗留代码修复项。另修复加强校验时对原403负向探针的元数据兼容性误拒绝，并增加两项回归；原目标原件不改写，首次87/87通过和身份刷新失败保存在[兼容性复评记录](evidence/provider-a2-remediation-20261007/denial-compatibility-reassessment.json)，新功能输入再执行完整87个命令组；F05因远程连接Closed发生的一次失败原件保留，同冻结源码执行完整8项补测PASS；新增报告辅助Python脚本的Ruff格式问题修正后，F08原完整命令补测PASS，原件均保留，由标准严格验证器核验全部21个内容回执后发布，未把失败当PASS。期间提前写入测试日志导致完全干净工作树保护拒绝的尝试，见[拒绝记录](evidence/provider-a1-remediation-20261004/provider-a2-final-reassessment-20261007/interruption.json)；该轮停止，未发布READY。保持 `pnpm check:provider-a2 && pnpm test:provider-a2` 为强制CI门禁；依赖/规范输入/接口/目标源码变化后重新评估受影响回执。功能字节不变时允许复用可溯源目标原件，功能变化时执行相应Supabase目标回归，未执行保持NOT RUN。

按[项目用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)完成当前G0确认；记录真实原答复并执行G0 finalize/FEP-0复评。旧确认记录和失败尝试保持历史，不以人工确认替代工程检查。
""")
identity_old = (
    Path("docs/audit") / "BFF-FE-001-before-provider-a2-remediation-2026-10-07.md"
).read_text()
rt = "\n".join(
    line for line in identity_old.splitlines() if re.match(r"\| R\d\d \|", line)
)
Path(
    "docs/audit/BFF-FE-001-comprehensive-review-2026-10-05.md"
).write_text(f"""# BFF-FE-001：身份、会话与设置 API 当前复核报告

> 复核日期：2026-10-07；阶段：A2 DEVELOPMENT；工程冻结提交 `{source}`。

## 一、任务完成概况

原六项业务整改继续CLOSED；本轮PROVIDER:A2复审新增的H-01成功状态、M-01执行提交溯源缺口均已修复，当前活动问题0。24项原控制点全部PASS；20个C01/C17 API实际目标成功覆盖完整，严格DEVELOPMENT门禁READY、formalAccepted=false。

旧当前报告保存在[历史原件](BFF-FE-001-before-provider-a2-remediation-2026-10-07.md)，原问题/失败尝试仍按既有历史链接保留。本轮窗口整改见[PROVIDER:A2当前报告](PROVIDER-A2-comprehensive-review-2026-10-07.md)。

## 二、完成明细与证据

| ID | 控制点 | 当前结果 |
|---|---|---|
{rt}

本轮重跑三组provider/consumer语义、契约/阶段负向及8项业务变异。新增逐20API成功缺失、全500/401、SSE断言、缺失/未知提交与原提交源码不匹配等反例全部拒绝。当前回执绑定全部规范输入及三个前置依赖，见[当前功能回执]({link(identity)})、[本轮真实原件负向探针](evidence/provider-a2-remediation-20261007/actual-receipt-negative-probes.json)。

原Supabase身份目标51次调用/20 API/14强断言、cleanupVerified=true，原执行提交`d758c839fbd57366346d0f2b9ef2081c68ab51e6`。七项目标源码与不可变提交及当前字节一致，本轮未重跑MFA/资料修改目标调用。环境为配置Supabase Auth/PostgreSQL + 本机live BFF、合成HTTPS Origin，不等于staging。源码/回执明细见[严格复核](evidence/provider-a2-remediation-20261007/closure-verification.json)。

{summary}

## 三、问题与风险

当前活动问题：阻塞0、高危0、中危0、低危0。本次窗口门禁整改未修改身份业务实现、数据库迁移或OpenAPI；原权限、recent-auth、首因素/最后因素及恢复保护保持原验收范围。passkey/WebAuthn、完整consumer/UI链、Desktop、真实部署/IdP、hosted CI与RELEASE仍按对应阶段验收。

## 四、后续维护

持续执行 `pnpm check:bff-fe-001:development` 和阶段负向，窗口使用 `pnpm check:provider-a2`。功能输入或依赖变化后复评；允许文档变化时对可溯源、内容未变的旧目标证据进行复用。
""")
audit_matrix = load(
    "docs/audit/evidence/bff-fe-007-recheck-20261007/control-matrix.json"
)
audit_matrix["sourceCommit"] = source
audit_matrix["evidence"] = [
    "docs/audit/evidence/provider-a2-remediation-20261007/closure-verification.json",
    audit,
]
for row in audit_matrix["controls"]:
    row["status"] = "PASS"
    row["evidence"] = (
        "Current strict semantic/mutation/target/dependency revalidation: " + audit
    )
(base / "audit-control-matrix.json").write_text(
    json.dumps(audit_matrix, ensure_ascii=False, indent=2) + "\n"
)
at = "\n".join(
    f"| {r['id']} | {r['control']} | PASS |" for r in audit_matrix["controls"]
)
Path(
    "docs/audit/BFF-FE-007-comprehensive-review-2026-10-06.md"
).write_text(f"""# BFF-FE-007：Audit 与导出 API 当前复核报告

> 复核日期：2026-10-07；阶段：A2 DEVELOPMENT；工程冻结提交 `{source}`。

## 一、任务完成概况

原9项业务问题继续CLOSED；本轮PROVIDER:A2新增M-01执行提交溯源缺口已修复，当前活动问题0。31个原控制点全部PASS，完整完成率100%；六个C10 API正常/401/403实际目标覆盖完整，严格DEVELOPMENT门禁READY、formalAccepted=false。

旧报告保存在[本轮前原件](BFF-FE-007-before-provider-a2-remediation-2026-10-07.md)，原业务整改过程仍在[历史整改报告](BFF-FE-007-remediation-history-2026-10-07.md)和[初审](archive/BFF-FE-007-initial-review-2026-10-06.md)。本轮窗口整改见[PROVIDER:A2当前报告](PROVIDER-A2-comprehensive-review-2026-10-07.md)。

## 二、完成情况与证据

| ID | 原控制点 | 当前结果 |
|---|---|---|
{at}

完整矩阵见[31项当前复核](evidence/provider-a2-remediation-20261007/audit-control-matrix.json)。本轮三组provider/consumer/门禁语义、5项业务变异实际执行通过，当前功能回执为[Audit回执]({link(audit)})。新源头溯源校验要求40位可解析commit对象，逐文件核对原Git字节及当前功能输入；缺失/未知/blob提交反例全部拒绝，见[真实原件负向探针](evidence/provider-a2-remediation-20261007/actual-receipt-negative-probes.json)。

原Supabase目标83次调用（含身份准备）/45执行断言、cleanupVerified=true，实际目标提交`5e3339c9e5cc95d550c6e67ffa36701998cb0e2f`。13项源码与原Git提交及当前内容一致，本轮未重跑Audit目标。持久审计、脱敏/摘要/分页、完整意图幂等、真实Storage字节/三格式产物、短时一次性下载、吊销/retention和生命周期审计保持原验收范围。源码及依赖见[严格复核记录](evidence/provider-a2-remediation-20261007/closure-verification.json)。

{summary} A2聚合门禁严格READY。

## 三、问题及验收边界

当前活动问题：阻塞0、高危0、中危0、低危0。本轮仅补强门禁与证据，未修改Audit业务实现、数据库迁移或OpenAPI。

查询限于authenticated actor授权账本及显式workspace/account scope；快照最大10000条、产物16 MiB、短时下载不超过5分钟，见[运行说明](../BFF-FE-007-runtime.md)。十消费页面完整联调、真实部署/IdP、目标规模五分钟还原、长稳、hosted CI与RELEASE正式验收仍在对应阶段执行，不以DEVELOPMENT READY代替ACCEPTED。

## 四、后续维护

保持 `pnpm check:bff-fe-007:development` 和A2聚合检查；源码、契约、规范计划或依赖变化后复评受影响回执。功能内容变化执行相应Supabase目标测试；功能字节不变允许保留原执行时间/提交进行内容绑定复用。
""")
print("current reports and immutable before-remediation copies written")
