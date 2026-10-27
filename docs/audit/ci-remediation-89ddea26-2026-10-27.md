# 89ddea26 CI 跟踪与修复（2026-10-27）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪基线为 `89ddea268e3494f7b495eb3ec3040d1aa3f2003f`，在 main 修复、验证并生成本地提交，不推送。本地结果绑定该基线及修改文件字节；新提交 hosted CI、真实数据库、交易所 HTTP、部署和发布验收均为 NOT_RUN。

## 远端终态

该 SHA 的 10 个 push 工作流全部结束，8 成功、2 失败。F01 Clean Room、F04 Core Branch Coverage、F08 Engine CI、F03、R01、F09、QuantOS Compatibility、Visual Baseline Candidates 成功，结果保留原 SHA/范围。F05/F07 无运行。

- [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40496957868)：PRE-01 发现登记表仍引用 API 1.16.0，当前 OpenAPI/生成物已是 1.18.0。
- [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40496957965)：完整历史 Secret scan 报告 156 个命中。verify-download 正常传播上游未完成状态，未修改该门禁。

## 接口盘点与追踪修复

受控 PRE-04 基线升级为 v1.12，登记 API 1.18.0、142 operations、132 schemas 和 792 字段行。不是只替换版本号：补齐原 catalog 遗漏的八个受控 Assisted 审批生命周期操作，归属 C08/BFF-FE-006；P11 读取同一审批请求与 Command 引用，补齐 catalog、A1 责任策略、页面台账及追踪中的 C08 关系。C09 原订单事实职责保留。同步 Gap、契约表、P0 依赖和 PRE-01 页面 API 登记。

十二个审批/命令引用 wire 模型及 C13 默认关闭准入模型同步入字段字典。该路径只有显式 opt-in 才能使用，接口名称含 testnet 不代表真实交易所连接或发布许可。两个接口名检查器补识别 approve 前缀；新增未知 approve 操作、P11 缺 C08 追踪、受控操作/模型被移除的拒绝回归，保留既有版本、来源、权限和字段漂移拒绝。

核对 provider 源码从上轮 4e20dc2f 到当前基线的变化：新增 Assisted 模块、默认 None 状态、显式 reference 构造和相应会话分支。仅更新 C01/C17/C10 当前 lib.rs 摘要，并复验认证、审计和 Assisted 默认关闭/恢复路径；不改原验收文件及其摘要。historicalReviewedSourceSha、reviewedSourceSha=null、原 Proto/JSON Schema/domainMappings 和旧 wire 模型均保留，维护盘点不重授历史 READY。

## 历史扫描修复

使用原固定版本 Gitleaks 8.28.0、配置、ignore 和完整历史入口复现同样数量的 156 个命中。本地扫描 990 commits、约 2.01GB；远端只输出数量，本地脱敏逐项报告单独保留。

逐项读取历史 Git blob：3 个提交分别命中 108、6、42 项，涉及 30 份历史浏览器 JSON。156 项全部为 generic-api-key 规则命中的 keyHash，均为完整 SHA-256 十六进制，所在行及对应对象具有 method/path/status/source/bodyHash 等请求记录字段。来源只有 REFERENCE_BYTES、REFERENCE_COMMITTED_RESPONSE_DROPPED 和 SYNTHETIC_FEP5_DECISION_CORRELATION。另核对 6 份历史 producer 快照，确认其执行 idempotency-key → SHA-256 → hex；该值用于自有请求去重，不是认证凭据。原始请求键未保留，因此没有声称反推并重算哈希。

仅追加这 156 条 commit/file/rule/line fingerprint 到 .gitleaksignore，原文件字节保持完整前缀；.gitleaks.toml、固定工具和 scripts/check-secrets.sh 未改。不增加路径、字段名、任意哈希或整条规则的通用豁免，不修改历史证据或 Git 历史。

真实扫描器反例新增两个本轮有命中的 G8/L03 路径；连同原四条路径，每条均验证干净控制后，在新提交中写入 API 字段、未审阅 digest 字段和 keyHash 形状值并要求拒绝。既有 GitHub/Slack 命中与工具故障控制保留，精确历史登记不能让未来同路径或同字段自动通过。

## 验证与边界

| 检查 | 结果 |
|---|---|
| PRE-01 / PRE-04 当前入口 | PASS；30 页、210 页面场景；17 契约、17 Gap、23 P0 单元、792 字段行 |
| PRE-01 / PRE-04 拒绝回归 | 91 PASS，0 skip |
| BFF 页面引用 / BFF-FE-000 / 生成物漂移 | PASS；142 操作、132 schemas、142 操作页面引用；基线反例 10 PASS |
| PRE-06 当前入口 / 回归 | PASS；回归 21 PASS，0 skip |
| 契约兼容检查 | PASS；基线为本次 push 前 SHA 4e20dc2f；不是 staging 签署 |
| auth/settings / audit/export provider | 17 / 14 PASS，0 FAIL |
| Assisted provider 默认关闭、同请求恢复、双审批及 native Command 路径 | 5 PASS，0 FAIL；受控自有协议范围，不是交易所 HTTP |
| 完整质量门禁反例 | 57 PASS，0 skip；包含六条历史路径的实际新提交拒绝控制 |
| F05/F07 手工策略 | 6 PASS，0 skip；未连接数据库 |
| 修改脚本 ESLint / git diff --check | PASS |
| 原完整历史扫描 | 修复前 FAIL 156；精确登记后 PASS，无新豁免规则 |

保留原 CI 失败、本地 PRE-01/PRE-04 漂移、首次 approve 未识别及 P11 责任策略未同步的失败。显式 ESLint 初次发现修改文件原有 Node globals 未声明，补齐显式绑定后复验通过；不压制规则。前端/主 CI 后续尚未抵达的步骤、新提交浏览器构建、全仓测试和发布矩阵不记作通过，也不因维护盘点递归重跑无关闭包。

[证据目录](evidence/ci-89ddea26-20261027) 留存远端终态、原失败日志、脱敏扫描报告、历史 blob/producer 审阅脚本与逐项记录、精确登记清单及各项验证日志。`.gz` 可用 gzip -dc 无损读取，完整性见 SHA256SUMS；source-binding 绑定修改文件及未变更的契约、provider、扫描器和手工策略输入。

F05/F07 仍仅 workflow_dispatch、确认默认 false，并要求 QUANTOS_MANUAL_F05_F07=1。本轮未运行数据库 campaign、读取或复制连接凭据、修改 secrets、推送或部署。下一步由用户推送本地修复提交后，跟踪新同 SHA 的完整历史扫描、前端盘点及后续 CI 步骤；旧 SHA 成功不改绑。
