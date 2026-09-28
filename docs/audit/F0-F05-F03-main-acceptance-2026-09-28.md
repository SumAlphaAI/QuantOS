# F0 F05 / F03 整改与主线验收（2026-09-28）

**结论：F05/F03 本轮缺陷已修复，主线工作流及目标验收通过；F0 总 Gate 7/7 PASS，关闭本阶段总 Gate。** 证据索引见 [f0-91e222f/index.json](evidence/f0-91e222f/index.json)。

## 1. 整改范围

基于已推送 `e57523cbc78510cbeb0c64984a90896a8d735283`，按 F0-B01、F0-H01 的依赖顺序修复，候选冻结为 `ab5317c8c3c37cfad315312742271975dd7c68f9`。原总 Gate 失败报告保留，本文记录新增事实。

| 问题 | 修复 | 候选验证 |
| --- | --- | --- |
| F0-B01：共享 outbox 测试串扰 | 新增显式 tenant 领取范围；所有 F05 fixture 和 F09 故障消费者仅领取自己的事件；空列表不领取，外部 sentinel 的状态、次数、owner/token 必须不变；默认生产消费者保持全局扫描 | Supabase 事件组 10/10；Nightly PASS。最终 main 的完整 target 重建回执已通过 |
| F0-H01：手动协议 Gate 无基线 | 必填 baseline_sha，拒绝空值、符号引用、HEAD 及非祖先提交；保留真实 Buf breaking 检查 | 3 项回归 PASS；手动 F03 完整 SHA 回执 PASS，92 个生成文件、日志摘要与比较基线核验 |
| 补验发现：TLS 用例与既有严格模式冲突 | 显式 prefer 等模式拒绝明文降级；覆盖缺失/非法/有效根证书和无效连接参数 | Nightly pg.rs region 85.545%、branch 85.484%；未放宽 TLS |
| 补验发现：Storage 指标入口覆盖不足 | 读取/删除成功和错误路径均测试，核对 5 条持久化操作记录、2 次失败；修正 macOS 测试 socket 非阻塞继承 | 实际 Supabase 持久化断言 PASS；Storage adapter line 98.742%、region 95.862% |

### 修复提交与失败保留

`b57f3f6`：fixture 范围与 F03 基线；`5c92a78`：TLS 严格拒绝用例；`70795d5`：TLS 根证书及无效连接覆盖；`8f2195d`：F09 故障消费者范围；`ab5317c`：Storage 成功/失败指标测试。随后正常合并提交为 `91e222f`。

失败过程不改写：F05 Nightly [36372548870](https://github.com/SumAlphaAI/QuantOS/actions/runs/36372548870) 暴露旧 TLS 期望，[36372876007](https://github.com/SumAlphaAI/QuantOS/actions/runs/36372876007) 暴露 pg.rs region 不足，[36373282758](https://github.com/SumAlphaAI/QuantOS/actions/runs/36373282758) 暴露 Storage line 不足；逐项补测试后候选及主线 Nightly 均通过。TLS 证书 fixture 只提交公开 CA，未提交私钥。

## 2. 候选证据

- F03 手动验收 [36374069504](https://github.com/SumAlphaAI/QuantOS/actions/runs/36374069504)：内部 sourceSha=expectedSha=候选完整 SHA，PASS；比较基线 `d0d81287664b5ab55515997481c9782b21455262`。
- F05 Nightly [36374063454](https://github.com/SumAlphaAI/QuantOS/actions/runs/36374063454)：内部同 SHA、dirty=false、PASS。10,000 条事件、side effects、dispatched、applied receipts 一致；checkpoint=10001；完整查询 89.817ms；总分支 134/154=87.013%。此性能与覆盖率来自 GitHub runner 测试库，不当作 Supabase 目标性能。
- 实际共享测试 Supabase：事件持久化 10/10（含 10,000 条事件和 1,000 次并发）；Storage DB 1/1；HTTP 故障/指标 3/3；真实 Storage 往返 1/1。长事件测试的二进制在后续测试提交前已编译，因此作为整改功能证据，不包装成最终同 SHA 的完整 target 回执。
- 候选 SHA 下 Supabase 事务内迁移重放：34 个迁移、39 张表，随后回滚。没有重置共享 quantos schema；其后经用户明确授权完成实际 schema 重建，并在同一 Supabase 服务器的独立临时数据库完成完整目录漂移比较。
- F09 push [36373989893](https://github.com/SumAlphaAI/QuantOS/actions/runs/36373989893)：内部同 SHA / clean / PASS，7 日志摘要和 3 类真实写 trace 核验通过；L04 范围不变。

## 3. 主线验收

PR #6 经 active Ruleset 的 strict、8/8 必需检查后正常合入；无 bypass actor，未使用管理员绕过。冻结主线为 `91e222f744fd350ab9db80ba7554bd1fee9194fa`。

| 项目 | 最终主线结果及回执 |
| --- | --- |
| CI / F02 | [36375181926](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375181926) SUCCESS；内部 commit 为最终 main SHA，downloadVerified=true、formalSignatureVerified=true；数据库 7 类检查及三生态 SCA PASS |
| F01 | [36375181990](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375181990) SUCCESS；内部 source.commit 为最终 main SHA、dirty=false；冷启动 256.367 秒，三次 combinedSha256 一致、reproducible=true |
| F03 | push [36375181884](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375181884) 与 manual [36375234245](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375234245) SUCCESS；手动内部同 SHA、92 个生成文件、日志摘要通过 |
| F04 | [36375181970](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375181970) SUCCESS；分支复算 43/44=97.73% |
| F05 | Nightly [36375219915](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375219915) SUCCESS；内部同 SHA / clean / PASS。10,000 个事件与唯一副作用、dispatched、applied receipts 全部对齐，checkpoint=10001；完整查询 159.374ms，branch=134/154=87.013%。Supabase reset 型 target 同 SHA / clean / PASS；全部迁移重建、事件组、Storage 持久化与真实往返通过 |
| F06 | 同 SHA 实际 DB 8 项、Auth/BFF 9 HTTP 场景、Runtime、Execution 六场景、Vault 8/8 拒绝通过；v2 Git note 已推送，严格 Gate 及 5 个负向探针 PASS。首轮一次 TLS 连接中断，保留失败日志；未修改源码的完整复跑通过。独立鉴权延迟诊断按既有范围未执行 |
| F07 | Nightly [36375223181](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375223181) SUCCESS；内部同 SHA / clean / PASS，100/100 恢复及唯一 Artifact，调度 P95=29.665497ms；line/region/branch=93.859%/86.954%/87.5%。实际服务链完成，临时管理员 Storage key 回执仍为 DIAGNOSTIC_ONLY，归 L04 边界 |
| F08 | CI [36375181952](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375181952)、Nightly [36375226552](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375226552)、目标 [36375257836](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375257836) 全部 SUCCESS；source-sha.txt 与目标内部同 SHA，wheel 安装及 9/9 场景通过 |
| F09 | push [36375181892](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375181892)、manual [36375231074](https://github.com/SumAlphaAI/QuantOS/actions/runs/36375231074) SUCCESS；各内部同 SHA、clean、PASS、7 日志摘要、3 类真实写 trace 核验。手动调度不等于观察到 cron |
| migration / TP | 主线实际 Supabase 34 个迁移事务重放、39 表、回滚，以及实际 RLS 均 PASS；独立远程参考数据库全量迁移、checksum/七类目录比较、列漂移拒绝、恢复后通过、同库自比较拒绝全部通过，参考库已删除。TP02–05 intake、TP01 本地正反例、真实 fork 治理只读查询 PASS。旧环境凭据曾导致 401，直接使用现有 gh 登录后查询通过，未上传凭据 |

### F0 七项条件重新统计

| 条件 | 结果 | 原因 |
| --- | --- | --- |
| F01–F09 完整开发 Gate | PASS | 同主线工作流、功能链、F05 Supabase reset 型目标及各分项回执齐全 |
| 远程 migration、drift、RLS、类型约束 | PASS | 经授权在实际 Supabase 重建；独立远程参考库七类目录比较及正反向检查、重建后实际 RLS 通过 |
| outbox/inbox、租约、去重、退避/DLQ/checkpoint、漏通知补偿 | PASS | 同主线 SHA Nightly/CI 与共享库整改功能验证通过 |
| Vault 受控解密、角色拒绝、容量规则/ADR | PASS | 同主线 F06 / F09 证据通过 |
| 服务可观测性及供应链追溯 | PASS | 同主线 F09 目标及 CI，范围沿用既有 L04 移交 |
| TP01–TP05 intake 评估 | PASS | intake Gate 和锁文件约束通过 |
| TP01-A/B baseline、副本、fork、禁止耦合 | PASS | 本地正反例及实际远程治理查询通过 |

**7 PASS / 0 PARTIAL / 0 FAIL，完成 7/7（100%）；F0 为 ACCEPTED，本阶段总 Gate 关闭。** F0-B01 的测试串扰缺陷、F0-H01 的手动基线缺陷已修复；F0-B02 的主线集成、F02 正式签名及全部同 SHA 回执已闭环。此前缺少的真实 Supabase 完整重建和独立 drift 回执已取得，未以 CI runner 或事务内重放替代。

## 4. 验收边界与后续风险

1. 用户明确授权重建当前测试项目的 quantos schema；本轮实际执行并通过。另建同一 Supabase 服务器的独立临时数据库作为参考，比较结束后已删除。参考库仅以 auth.users/auth.uid/storage.buckets 提供平台兼容前置对象，quantos 本身完全由全部仓库迁移构建；不宣称其是另一个完整 Supabase 项目。
2. 本轮 main 的 14/14 工作流、8/8 必需检查、正式签名和独立下载已经通过；后续文档提交不自动继承该源码验收，本文结论仅绑定 `91e222f744fd350ab9db80ba7554bd1fee9194fa`。
3. TP01 Actions 专用读取凭据仍缺；保留此前人工只读治理验证与自动化失败事实。
4. 本次未安装本地 PostgreSQL/Supabase，未降低覆盖率、F02 验签、wildcard 或漂移门禁。

实际数据库使用已配置的共享测试 Supabase；部分脚本原始 targetClass 含 isolated 字样，不代表本轮创建独立项目。用户授权后实际执行 schema reset。候选阶段原始功能日志保存在 `artifacts/f0/ab5317c/`，主线核心回执与本轮失败/复跑日志存于上述版本化证据目录。

## 5. 最终目标回执

最终 F05 target 为同 SHA、dirty=false、PASS：4 个检查记录；eventCount、uniqueSideEffects、dispatched、appliedReceipts 均为 10000，checkpoint=10001。Supabase 查询计量 37398.366ms，口径 `target-event-id-client-retrieval`；它不是该跨区域目标完整 payload 的五秒性能承诺，完整载荷门槛由同 SHA CI/Nightly 验证。

首次 reset 确认参数被环境文件覆盖，Gate 在任何重建之前拒绝；改为 Make 显式参数后执行。参考库探针首次连接中断，重试创建/连接/删除通过。失败与最终回执一并保存，未降低任何断言。关闭仅适用于上述完整 main SHA 的 F0 开发阶段；L04 上线前移交项和未来业务入口验收保持有效。
