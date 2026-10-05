# FRONTEND-GATE:G0 全面复审证据

日期：2026-10-05；源码：`ca00fe80b1bbc772287193bc6b7973eaeda224b0`；开始时工作区干净。结论：CHANGES_REQUESTED，18/24 控制点 PASS（75.00%），1 阻塞级、4 中危问题，G0 尚不能 DEVELOPMENT READY。

[主报告](../../FRONTEND-GATE-G0-comprehensive-review-2026-10-05.md)保留任务概况、完成统计、分级问题和整改建议。本轮只新增报告及证据，未修改业务代码、计划状态或历史日志。

| 文件 | 用途 |
|---|---|
| [control-matrix.json](./control-matrix.json) | 24 个等权控制点、状态、事实与问题归属 |
| [findings.json](./findings.json) | 5 项独立整改问题、模块/表现/影响/建议 |
| [executions.json](./executions.json) | 17 个静态/回执命令、实际时间、退出码与日志摘要 |
| [runtime-executions.json](./runtime-executions.json) | 5 个运行时/规范命令、实际时间、退出码与日志摘要 |
| [environment.json](./environment.json) | 工具链、受控公开 local-mock profile、构建来源及未执行边界 |
| [source-inputs.json](./source-inputs.json) | 955 个当前文件与 83 个依赖证据文件的内容摘要 |
| [dependency-stage-snapshot.json](./dependency-stage-snapshot.json) | 15 节点闭包；14 上游 READY，G0 NOT_ASSESSED |
| [independent-probes.mjs](./independent-probes.mjs) | 可重放的内存变更/ESLint stdin 反证，不修改原输入 |
| [independent-probes.json](./independent-probes.json) | 基线及 5 项范围/约束探针的实际接受/拒绝结果 |
| [production-import-probe.txt](./production-import-probe.txt) | 生产页面路径下实例化旧 InMemory backend 的实际 stdin |
| [production-import-probe.log](./production-import-probe.log) | lint 原始输出；空文件表示无诊断，退出0另存 probes.json |
| [manifest.json](./manifest.json) | 报告与本证据目录文件的 SHA-256/大小，不包含自身 |

22 个检查命令全部退出 0，但不代表 G0 完成：本节点回执、当前范围确认和治理/版本/导入约束仍有缺口。计划结构与历史治理本来不执行完整 G0 内容验收，独立探针的两个形状/文档变更用于确认其范围；其余三个探针发现兼容策略、版本和生产导入约束未被强制检查。不要把探针驱动脚本退出0理解为缺陷已修复。

本轮实际执行：计划35项、PRE-01 32项、PRE-04 38项、A1 8项、上游回执41项正负测试；auth/API-client/contract共100项；Chromium11项（OIDC4、Command7，含axe/1440视觉/390只读，retries=0）；Web smoke、一期lint/typecheck及契约生成一致性。SSE7项PoC及安全回归在100项组合套件内，不额外累加。

构建产物沿用已存在的同输入4eee7f7来源，Web smoke校验实际sourceDigest/profile并启动浏览器；本轮未重新build。既有14节点功能回执重新检查了内容和依赖，65项历史有效结果未全部重跑。Proto/coverage/Supabase已有证据被内容校验，均不称为本轮新执行。

没有连接数据库、运行Supabase本地环境/Docker/临时DB、真实IdP/staging、部署或取得hosted CI/当期组织确认。RELEASE/后续provider/P16独立验收，本轮不提前关闭。
