# 036a78a3 CI 跟踪与修复（2026-10-29）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。远端与本地基线为 `036a78a3ee2703c9aaff130e7092516d1b70a559`，在 main 维护当前接口盘点并生成本地提交，不推送。新提交 hosted CI、目标数据库、全量联调和发布验收保留 `NOT_RUN`。

## 原提交远端结果

该 SHA 的 13 次运行全部结束：10 个 push 中 9 成功、1 失败，3 个 schedule 均成功。

- [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/40711423418) 的 clean-room 和 reproducibility 两个 job 均成功。
- [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40711422829) 的 verify、verify-download-ci、verify-download 均成功，原凭据扫描及后续主 CI 已通过。
- [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40711422816) 的两个 A2 mutation/Gate 入口及 A2 provider 检查均已通过，随后在 `Interface inventory (PRE-04)` 失败。
- 其余 push 的 F03、F04、F08、F09、R01、Compatibility，以及定时 F08 Nightly、F09、R01 成功。未查询到该 SHA 的 F05/F07 运行。F09 定时 job 中 local-observability 成功，release-candidate 和 supabase-target 跳过，不能记作目标环境通过。

上述成功只绑定原 SHA 与各工作流范围。Frontend 在 PRE-04 后的步骤未由该运行验证，不能把主 CI 的成功当作完整 Frontend Baseline 成功。

## 原因与维护内容

原错误为 C01、C17、C10 的 `provider/test/historical receipt matches services/bff-gateway/src/lib.rs` 三项失败；当前 Node 入口复现同样三项。PRE-04 v1.12 对共用 provider 的摘要仍绑定 `10d13870229a3b9f6325b23fbde3203b466b27d3`。已定位对应 Git blob，逐项核对其到当前源码的 diff；当前 lib.rs 最后改动为 `41344ffcc40910662d3d043a494be41cfdbd1975`。

变化包含 RestrictedReference 的构造与导出、会话/MFA 数据的序列化、显式 assisted reference 的初始审计隔离、持久化 transaction middleware、assisted 会话的 audit:read 能力，以及共同 C10 查询的持久状态刷新/关联读取。普通 reference 无 durable store 时 transaction 直接进入原处理路径；refresh_common 在无 assisted host 时直接返回。对照 diff 和直接相关现有测试复核后，维护当前源身份，不把新源码误写成旧历史验收已覆盖。

受控基线升级为 v1.13，仅更新三处 lib.rs 摘要和版本/日期/本轮说明，重新渲染字段字典版本头，同步 PRE-04 总结。API 1.18.0、142 operations、132 schemas、792 字段行、其他 provider/test 摘要、两个历史验收文件及其摘要、historicalReviewedSourceSha、reviewedSourceSha=null、各实现 local-reference-only 与目标 `NOT_RUN / NO_RECEIPT` 均不变。字段字典除版本/日期头外逐字一致。

本轮没有改业务源码、测试断言、检查器或 CI 步骤；原源码身份漂移、缺失实现依据、虚假状态和字段漂移的拒绝检查继续执行。PRE-04 盘点 PASS 不授予历史 READY、当前业务集成或发布许可。

## 当前本地验证

| 范围 | 结果 |
|---|---|
| 原 PRE-04 Node 入口 | 修复前 FAIL 3；维护后 PASS，17 contracts、17 gaps、23 P0 units、792 fields |
| 原 PRE-04 negative + F05/F07 手工策略 | 52 PASS、0 skip（46 + 6）；未执行数据库 campaign |
| auth/settings / audit/export provider | 17 / 14 PASS、0 fail、0 ignore |
| live settings policy | 8 PASS；其余库测试按明确 filter 未执行 |
| 直接相关 BFF core_l04 | 3 PASS；已有回环 mTLS、重启/副本、共同 C10、logout/崩溃恢复路径；非真实交易所 |
| PRE-01、PRE-06、BFF 页面覆盖、BFF 生成物漂移 | PASS；30 页/210 场景、142 操作/132 schemas；结构/生成检查不代表运行完整浏览器套件 |
| 开发计划跨文档检查 | PASS；未提升目标验收或 formalAccepted |
| 盘点差异与历史保留核对 | PASS；只改三处当前源摘要及元数据，原历史与其他输入保留 |
| git diff --check | PASS |

首次 `pnpm check:pre04` 停留在包管理器启动，未产出 validator 结果后中止，exit 130，原日志保留。随后直接运行 package.json 登记的同一 `node scripts/pre04-inventory.mjs`，完成修复前复现与修复后验证；中止不记 PASS。L04 测试使用允许回环监听的执行权限，未连接数据库或外部交易所。

没有因盘点版本维护扩大为全仓测试、三轮 F01 重建或整条验收依赖链；未安装/启动本机 PostgreSQL、Supabase 或容器，未读取数据库凭据、写入真实数据库、修改 secrets、推送或部署。F05/F07 原手工 opt-in 策略保持。

## 证据与后续

[证据目录](evidence/ci-036a78a3-20261029) 保存原提交远端运行/job 终态、失败全文、PRE-04 修复前后结果、原受控盘点、provider 历史 diff、源身份复核和当前测试输出。gzip 无损保留原字节，SHA256SUMS 绑定归档，source-binding.json 以独立 path/sha256 字段绑定修复及未修改输入。凭据扫描的最终结果由提交后原入口复查确认。

用户推送本地修复提交后，需复查新同 SHA 的 Frontend Baseline 与后续步骤；本地盘点和直接回归通过不代表新提交已经取得远程 CI 或目标环境验收。
