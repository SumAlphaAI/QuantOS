# 2dafc0a4 CI 跟踪与修复（2026-10-25）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪源码为 `2dafc0a4bd85f6e5b194a486a31fc7b000ed6067`；在 main 完成本轮修复并生成本地提交，不推送。修复文件与逐项 SHA-256 见[证据目录](evidence/ci-2dafc0a4-20261025)的 `source-binding.json`。历史 FAIL/PASS 保留原始版本与适用范围，不改绑为新提交验收。

## 远端结果与根因

该 SHA 的 9 个 push 工作流全部结束：7 成功、2 失败。QuantOS Compatibility 的 Chromium、Firefox、WebKit 三个 job 全部成功；F01 Clean Room、Visual Baseline Candidates、F03、F08、F09、R01 也成功。前轮 Linux 引用及 F01 修复已得到该 SHA 的远端验证。

| 失败入口 | 失败位置 |
|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40177948925) | `BFF compatibility and semantic remediation regressions` 中的 `exact registered security correction is accepted only within its window` |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40177948913) | BFF OpenAPI/generated contracts 步骤运行同一测试失败；verify-download 随上游失败而拒绝继续 |

实际兼容性检查先返回 PASS、0 changes，随后单元回归错误地要求历史 1.3.0 基线与旧安全修正登记接受当前 OpenAPI 1.16.0。旧登记允许版本只到 1.14.0，且当前契约有未登记的差异；校验器返回 FAIL 正确。测试使用的日期是 2026-10-03，有效期截至 2026-11-03，故原因并非当前时间导致例外过期。

诊断保存为 `correction-before.json.gz` 和 `root-cause.json.gz`：原比较有 88 项差异、0 项接受。仅在内存中假设增加版本许可，仍有 4 个精确路径/摘要不匹配（审批列表与详情参数，以及下载 URL 长度/模式），因此不能简单追加版本豁免。本轮没有写入该假设、扩展例外或改变有效期。

## 修复

1. 将历史例外回归绑定到真实的 1.14.0 契约快照，来源为 `87fbc37eb0c92de539d864989eff4b4636a04ba3:bff/openapi/quantos-bff.v1.yaml`。快照以 JSON 无损压缩存放于 `scripts/fixtures/bff-security-correction-1.14.0.json.gz`，附带原 YAML、压缩/解压内容摘要与来源说明。验证其语义与原 Git 源一致，不依赖 CI checkout 是否保留旧提交历史。
2. 保留完整 85 项真实登记修正的回归：窗口内和截止当日通过，截止次日 85 项全部拒绝。新增快照完整性、未登记版本、错误基线、错误 admission 和修改前后摘要的拒绝检查。
3. 将原“未登记破坏性变更”负向探针也改为从已知可通过的历史候选出发，断言每个变异只因指定的 type/enum/路径变化失败，85 项原修正仍被识别，避免原测试因无关的版本拒绝而假阳性。

当前 OpenAPI、历史例外登记、兼容性校验器、实际 CI 兼容性入口、工作流与门禁均未修改，下载门禁失败传播也保留。当前语义测试继续使用实际 OpenAPI；实际 push 的基线兼容性检查继续独立执行。

历史 1.3→当前 1.16 在旧登记下的 FAIL 原样保留，不转为当前兼容性或发布 PASS。本轮真正通过的当前检查是相对 push 基线 39ce9714，以及相对修复基线 2dafc0a4，均无契约变更、未使用任何登记例外。

## 验证与证据

| 命令/核对 | 结果 |
|---|---|
| 修复前 `node --test scripts/bff-remediation-negative.mjs` | 复现相同失败；`local-before.log.gz` |
| `QUANTOS_BFF_BASE=39ce9714… CI=true pnpm check:bff-compatibility` | PASS，0 changes、0 registeredCorrections；与失败 CI 的真实 push 基线一致 |
| `pnpm test:bff-remediation` | Node 21 PASS，Vitest 两文件 20 PASS，0 fail/skip；包含当前语义、请求响应及 SSE 安全回归；`remediation-regression.log.gz` |
| `QUANTOS_BFF_BASE=2dafc0a4… CI=true node scripts/check-bff-compatibility.mjs` | PASS，0 changes、0 registeredCorrections；`current-baseline-compatibility.log.gz` |
| 原始快照与策略完整性 | JSON 与原 Git YAML 语义相等，摘要匹配；当前契约/登记/校验器及指定入口字节未变；`fixture-verification.json.gz` |
| 手工数据库策略负向测试 | 6 PASS，未连接数据库；`manual-policy-negative.log.gz` |
| Gitleaks 8.28.0 | 历史 933 commits 与原始证据（含解压快照）均无命中；`secrets-history.log.gz`、`raw-artifact-secret-scan.log.gz` |

原始远端 job、终态列表及本地失败/通过记录均无损压缩保留，`SHA256SUMS` 绑定证据字节。快照压缩只用于体积管理，原始解压 JSON 已执行扫描。此次仅修改测试和新增固定输入；无运行时代码变化，不重跑无关全仓、浏览器、数据库或上游 campaign。

## F05/F07 与待验项

确切 SHA 的工作流清单中 F05/F07 均为 0 次运行；该提交中两个入口仍只有 `workflow_dispatch`、确认默认 false，job 需确认且设置 `QUANTOS_MANUAL_F05_F07=1`。相关源码本轮未改动，自动离线检查保留；没有执行全量数据库或覆盖率 campaign。证据见 `manual-policy.json.gz`。

新修复提交的远端 CI：`NOT_RUN`，须用户推送后跟踪。该状态不影响 2dafc0a4 已取得的 Linux 三浏览器与 F01 原范围成功，但不能把那些结果改绑到新提交。数据库、发布和目标环境验收继续为 `NOT_RUN`。

下一步：用户推送本地修复提交后，跟踪新 SHA 的 Frontend Baseline 与 QuantOS CI 及后续门禁，继续保持 F05/F07 手工边界。
