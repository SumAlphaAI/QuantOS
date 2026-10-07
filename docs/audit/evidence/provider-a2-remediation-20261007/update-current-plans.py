from pathlib import Path
import json
import re

base = Path("docs/audit/evidence/provider-a2-remediation-20261007")
c = json.loads((base / "closure-verification.json").read_text())
counts = c["stageCounts"]
pending = c["g0"]["status"] == "BLOCKED"
state = f"{counts['READY']} READY、{counts.get('BLOCKED', 0)} BLOCKED"
confirmation = (
    "当前 G0 范围 b2fd984536e0 待项目用户确认，G0/FEP-0 工程 PASS、准入 BLOCKED"
    if pending
    else "当前 G0 范围 b2fd984536e0 已由项目用户确认，G0/FEP-0 严格 READY"
)
summary = f"2026-10-07 PROVIDER:A2 整改复验完成：原 4 项问题全部关闭，24/24 控制点 PASS；F0/A1 87/87、G0 16/16、FEP-0 2/2 工程通过，A2 聚合门禁严格 READY。当前 {state}；{confirmation}。原问题、失败尝试及旧确认完整保留，hosted CI/RELEASE 独立验收。见[当前报告](./audit/PROVIDER-A2-comprehensive-review-2026-10-07.md)。"
p = Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md")
s = p.read_text()
s = re.sub(r"> 2026-10-07 PROVIDER:A2 [^\n]+", "> " + summary, s, count=1)
s = s.replace(
    "> 2026-10-07 旧 READY 复评完成：",
    "> 历史快照（本轮整改前）：2026-10-07 旧 READY 复评完成：",
    1,
)
s = s.replace("> 版本：3.39", "> 版本：3.40", 1)
s = re.sub(
    r"> 状态：[^\n]+",
    f"> 状态：PROVIDER:A2 DEVELOPMENT READY；当前 {state}；{confirmation}；PROVIDER:ALL 与 RELEASE 独立验收",
    s,
    count=1,
)
entry = (
    "- `3.40`：完成 PROVIDER:A2 四项整改；逐 API 成功状态和不可变执行提交/源码校验、26 API 专用聚合 policy/manifest、递归依赖、31 项负向及强制 CI 入口生效。全依赖 87/87 实际复评通过；身份/Audit 新语义与 8/5 项变异拒绝通过，127 项门禁负向及 11 项真实原件异常探针通过。两子任务目标字节未变，复用原 51/83 次 Supabase 目标及 7/13 项内容溯源；未把原目标改记为本轮执行。"
    + f"当前 {state}；{confirmation}。当前检查报告重构，初审与旧报告保留原件。\n\n"
)
s = (
    re.sub(r"^- `3.40`：[^\n]+", entry.strip(), s, count=1, flags=re.M)
    if re.search(r"^- `3.40`：", s, re.M)
    else s.replace("## 版本变更说明\n\n", "## 版本变更说明\n\n" + entry, 1)
)
s = re.sub(
    r"- 当前工程复核：2026-10-07，格式重构后的依赖已刷新[^\n]+",
    "- 当前工程复核：2026-10-07，PROVIDER:A2 新增高危/中危门禁缺口已关闭；当前 DEVELOPMENT 严格 READY。三组语义、22 项契约/44 项阶段负向及 8 项真实变异拒绝通过；7 项目标源码与原 Git 提交/当前内容一致，复用原 51 次 Supabase 调用和14断言及清理，未重跑目标。见[当前功能回执](./audit/evidence/bff-fe-001-remediation-20261005/provider-a2-final-reassessment-20261007/a2.json)和[当前报告](./audit/BFF-FE-001-comprehensive-review-2026-10-05.md)。",
    s,
    count=1,
)
s = re.sub(
    r"当前复核（2026-10-07）：活动问题 0，31/31 控制点 PASS[^\n]+",
    "当前复核（2026-10-07）：活动问题 0，31/31 控制点 PASS，严格 DEVELOPMENT READY；新增执行提交溯源门禁缺口已关闭。三组语义和5项真实变异拒绝通过；13项目标源码与不可变提交及当前内容一致，复用原83次调用/45断言和清理，本轮未重跑目标。见[当前报告](./audit/BFF-FE-007-comprehensive-review-2026-10-06.md)、[当前功能回执](./audit/evidence/bff-fe-007-remediation-20261006/provider-a2-final-reassessment-20261007/development.json)与[窗口严格复核](./audit/evidence/provider-a2-remediation-20261007/closure-verification.json)。",
    s,
    count=1,
)
marker = "#### 迭代 A3：页面 API 开发与 provider 功能验证"
a2 = "当前工程复核（2026-10-07）：24/24 控制点 PASS，26/26 API 有契约允许的成功目标证据，三个直接依赖及递归回执有效，DEVELOPMENT 严格 READY、formalAccepted=false。窗口自身 [功能 manifest](./audit/evidence/provider-a2-remediation-20261007/development/provider-a2.json) 绑定规范输入、依赖、API 覆盖及三组实际执行。执行 `pnpm check:provider-a2 && pnpm test:provider-a2` 或 `make provider-a2-check`；31 项专用负向和 CI 强制接线已验证。关闭依据见[当前复核报告](./audit/PROVIDER-A2-comprehensive-review-2026-10-07.md)。\n\n"
s = re.sub(
    r"^当前工程复核（2026-10-07）：24/24 控制点 PASS[^\n]+\n\n", "", s, flags=re.M
)
s = s.replace(marker, a2 + marker, 1)
p.write_text(s)
p = Path("docs/SumAlpha-QuantOS-Development-Plan.md")
s = p.read_text()
s = re.sub(r"^> 2026-10-07 PROVIDER:A2 [^\n]+\n\n", "", s)
s = "> " + summary + "\n\n" + s
s = s.replace(
    "> 2026-10-07 旧 READY 复评完成：",
    "> 历史快照（本轮整改前）：2026-10-07 旧 READY 复评完成：",
    1,
)
s = s.replace("> 版本：3.35", "> 版本：3.36", 1)
s = re.sub(
    r"> 本轮变更：[^\n]+",
    f"> 本轮变更：PROVIDER:A2 四项整改关闭；受影响基础/准备 21 节点复评 READY；当前 {state}；{confirmation}。实际工程、内容复用目标、人工确认与 hosted CI/RELEASE 分层记录。",
    s,
    count=1,
)
s = (
    re.sub(
        r"^- `3.36`：[^\n]+",
        entry.replace("`3.40`", "`3.36`").strip(),
        s,
        count=1,
        flags=re.M,
    )
    if re.search(r"^- `3.36`：", s, re.M)
    else s.replace(
        "## 版本变更说明\n\n",
        "## 版本变更说明\n\n" + entry.replace("`3.40`", "`3.36`"),
        1,
    )
)
s = s.replace("当前阶段归属以 3.35、", "当前阶段归属以 3.36、", 1)
p.write_text(s)
print("plans updated", state)
