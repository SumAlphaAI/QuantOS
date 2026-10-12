# TP01-C_LOCAL 本地准入与 13 节点复验（2026-10-12）

结果：`CORE:TP01-C` 的 `TP01-C_LOCAL` DEVELOPMENT Gate **READY**。新冻结源码 `bacc3b6040f7a02bb0b3a46159c61ca00c3c59f6` 从干净提交完整执行 13 节点必要闭包的 45 组唯一检查，45 PASS / 0 FAIL；1259 个唯一功能输入逐字节复核通过。12 组目标/远程治理检查保持 NOT_RUN，测试/`RELEASE-GATE:BETA` 首次发布前实际验收。`formalAccepted=false`。

本轮只授予 TP01-C 本地开发准入；12 个上游节点是 TP01-C 专属 LOCAL_READY 投影，不写为全局 READY。原 F0/TP03/TP04/R03/R04 五个 READY 因公共输入变化撤回，历史证据保留。全图 **1 READY / 158 NOT_ASSESSED / 0 BLOCKED**；R1-SERVICE 仍 NOT_ASSESSED。

## 实现与变更文件

- `scripts/provider-a1-receipts.mjs`、`scripts/provider-a1-policy.json`：新增严格绑定单一消费者的 `TP01-C_LOCAL` profile、13 节点/45 组必要本地检查、12 组发布移交清单，保留候选 SHA、实际输入、命令、退出状态、日志及支持制品摘要。
- `scripts/tp01-c-local-gate.mjs`、`scripts/record-tp01-c-local.mjs`：独立验证和记录入口；递归验证成功后才发布。候选混用、范围漂移、缺失节点、摘要破坏、目标冒充通过均拒绝；写入/发布后验证失败恢复原字节。旧严格 Gate 和发布 Gate 仍拒绝本地投影。
- `scripts/tp01-c-local-gate.test.mjs`：32 项专用正负向测试，包含错误 owner/profile/schema、候选与输入漂移、闭包缺失/重复、依赖破坏、目标/正式字段越权、移交遗漏、零写入与回滚。
- `Makefile`：新增 `tp01-c-assess-local`、`tp01-c-local-check`、`tp01-c-release-check`。两份开发计划及 `scripts/development-plan-order-policy.json` 同步准入注册/验收边界/发布义务。
- [本地规程](../operations/tp01-c-local-admission.md)与 `engines/vibe-adapter/README.md` 说明执行边界。TP01-A 采用本地固定 readonly/controlled fork、锁/许可证/SBOM 内容验证；GitHub 远程治理未执行。F07 采用实际本地 Runtime/gateway 测试补足功能依赖。
- 新增本报告、回执、原始日志、支持制品、历史字节归档和证据校验工具；TP01-C 旧组件工程回执重新记录为 engineering PASS、严格依赖 BLOCKED（没有伪造上游 READY）。全部路径见 [变更清单](./evidence/tp01-c-local-20261012/changed-files.txt)。

## 冻结复验与 Gate

完整执行命令（PATH 固定 pnpm 10.20.0；runner 清除数据库/目标凭据并设置 `QUANTOS_SKIP_ENV=1`）：

```sh
node scripts/record-tp01-c-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/tp01-c-local-20261012/attempt-01
```

[45 组执行台账](./evidence/provider-a1-remediation-20261004/tp01-c-local-20261012/attempt-01/execution-results.json)含原始命令/时间/结果/日志摘要；本轮无拼接历史或同源补测。

| 必要节点 | 本轮投影 | 节点检查组数（跨节点共享组去重后共45） |
| --- | --- | --- |
| CORE:F01 | LOCAL_READY，仅供 TP01-C | 5 |
| CORE:F02 | LOCAL_READY，仅供 TP01-C | 8 |
| CORE:TP01-A | LOCAL_READY，仅供 TP01-C | 3 |
| CORE:F03 | LOCAL_READY，仅供 TP01-C | 3 |
| CORE:F04 | LOCAL_READY，仅供 TP01-C | 5 |
| CORE:F05 | LOCAL_READY，仅供 TP01-C | 5 |
| CORE:F06 | LOCAL_READY，仅供 TP01-C | 2 |
| CORE:F07 | LOCAL_READY，仅供 TP01-C | 2 |
| CORE:TP01-B | LOCAL_READY，仅供 TP01-C | 2 |
| CORE:F08 | LOCAL_READY，仅供 TP01-C | 3 |
| CORE:F09 | LOCAL_READY，仅供 TP01-C | 2 |
| CORE-GATE:F0 | LOCAL_READY，仅供 TP01-C | 3 |
| CORE:TP01-C | LOCAL_READY，仅供 TP01-C | 4 |

| 测试命令/检查 | 实际结果与范围 |
| --- | --- |
| `node scripts/verify-reproducible-builds.mjs --mode reproducibility --runs 3` | 3 轮独立源码/安装/输出目录构建 PASS；合并摘要全部 `2ec0dbed3407f3ab43afc3b4c04b1f3d864c369b9d851e9745cf2f1be917b97c` |
| `make lint`、`make test` | PASS；Python 全套 1382 PASS；Rust 保留 2 项已有 ignored、domain-ui 保留 3 项已有 skipped，均不计作执行通过 |
| `node engines/vibe-adapter/check-development.mjs --record` | 7 组工程检查 PASS，Python 1382、Manager 55 PASS；ruff/format/pyright/lock/计划检查 PASS；严格依赖保持 BLOCKED |
| `make f08-check`、`make f08-nightly-check`、`node scripts/f0-development-checks.mjs --engine` | 功能、分支覆盖及实际安装 wheel 的独立 UDS 服务链 PASS（9 项服务测试） |
| F01–F09 其他本地命令 | 原始台账中逐项 PASS，包含契约、迁移静态、负向、供应链、Runtime、存储 HTTP、观测与计划；不是 Supabase 目标执行 |
| `node --test scripts/tp01-c-local-gate.test.mjs` | 冻结后 32/32 PASS，0 skipped |
| `node scripts/r1-process-cleanup.cjs`（由完整 runner 调用） | 实际进程检查 PASS；本轮独立 scope、基线与候选 SHA 已绑定；discovered=[]、remaining=[] |
| 收尾八文件 Node 负向/回归套件 | 238/238 PASS，0 skipped；完整命令见收尾台账 |
| `make tp01-c-local-check`、递归证据校验 | PASS；13 节点、45 日志、1259 输入、历史归档和全图状态核对 |
| `make tp01-c-release-check`、旧组件 `--ready`、`make f0-local-check`、`make r04-gate-check` | 全部预期 exit 2，拒绝发布/严格依赖/失效旧范围准入 |

发布回执：[manifest](./evidence/tp01-c-local-20261012/manifest.json)；递归结果：[verification](./evidence/tp01-c-local-20261012/verification.json)。完整收尾台账记录在 [final-02](./evidence/tp01-c-local-20261012/final-02/results.json)，完整收尾 11/11 PASS（含 4 项预期拒绝）。本轮 evidence/history 与新 attempt 两个目录的脱敏 secret 扫描均 PASS。

## 失败证据与纠正记录

1. 本轮冻结前拒绝探针保留于 [preflight](./evidence/tp01-c-local-20261012/preflight/guard-probes.json)：未准入/发布/旧严格验证真实拒绝，不迁移为本轮准入证据。
2. [历史归档](./evidence/tp01-c-local-20261012/history/bacc3b60/index.json)保留 27 份旧 canonical/旧五项 Gate 原始字节，与冻结提交 `git show` 独立比对一致。原 TP01-C BLOCKED/UDS 失败及前轮 TP01-C/R1 inventory 的 2518 文件证据保留在既有路径。
3. [F0 目标失败清单](./evidence/f0-target-diagnostics-20261012/summary.json)的 144 文件全部 hash 不变，保留 F06/F07 HTTP500、只读数据库和 F09 调度失败。开发阶段移交不等于这些问题已修复。
4. [本轮 final-01](./evidence/tp01-c-local-20261012/final-01/results.json)：10 组 PASS、计划链接检查 1 FAIL，原因是新增报告链接时报告尚未写入；原始错误日志保留。补齐报告后重跑完整收尾检查，不修改或替换首次失败；不影响已完成的 45 组功能闭包。

## 风险与发布移交

- Supabase、远程分支保护/fork 治理、真实 BFF/Runtime 部署/权限、持久 Artifact/取消恢复、OS egress、代表性性能/容量/长稳、候选同 SHA hosted CI 均未验收，12 组必要前置目标检查为 NOT_RUN。正式发布必须重新绑定发布候选完整源码、实际目标证据和 ProjectUser 确认，本地回执不能代替。
- 本地 Artifact/owner/execution/取消状态使用内存；mock 工具产生计划，不证明真实 LLM/工具执行、持久恢复或 OS 网络隔离。Rust 数据库集成测试在无 DATABASE_URL 时提前返回的结果不能视为数据库通过，2 ignored/3 skipped 同样不扩大结论。
- 固定供应链、许可证检查不授予真实数据用途或上游运行时权利。本轮未消费退役的 32 条历史事实、未新采集行情。
- 未升级订阅、未使用生产凭据、未推送/外部发布、未启动本机 PostgreSQL/Supabase/容器。软件 SCA 可读取公共漏洞公告，这不构成目标环境验收。

## Git 与下一可执行任务

源码提交：`bacc3b6040f7a02bb0b3a46159c61ca00c3c59f6`。验收证据与当前阶段字段另作本地提交；[证据封存清单](./evidence/tp01-c-local-20261012/seal.json)记录源码基线、报告/实际制品摘要和完整变更清单，证据提交不改功能输入。

下一可执行任务：**TP01-D 本地接口、20 组双 RPC fixture 与 R02 合成研究输入必要前置预检**；先明确 `TP01-D_LOCAL` 消费者和必要本地闭包，再独立实现/复验其准入。当前 TP01-C_LOCAL 不自动放行 TP01-D 或 R1-SERVICE。
