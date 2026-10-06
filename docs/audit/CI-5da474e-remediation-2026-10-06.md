# 5da474e CI 故障整改与复验报告

## 一、任务完成概况

2026-10-06 复核已推送提交 `5da474e8bd715a25d1d7b98cfe7ca41dfc554439`。两条失败运行分别停在 Python lint 与 A2 离线语义测试，前轮子模块 pin、迁移 RLS 预检问题已通过原失败步骤。本次修复依赖准备和 Python 检查范围，冻结源码 `dd8672c81981c0db2a59b572197382fc849cafa4`；完整 F0/A1 **87/87 PASS**，A2 DEVELOPMENT READY，G0 **16/16**、FEP-0 **2/2** 工程 PASS。阶段台账 **22 READY、2 BLOCKED**；两个 BLOCKED 仅来自当前 G0 范围的项目用户确认待办。本次未推送，新提交 hosted CI 待用户推送后验证。

## 二、完成情况明细统计

| 原失败运行 | 根因与影响 | 修复及验证 |
|---|---|---|
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37407823067) | 完整初始化固定上游后，根目录 Ruff 扫描了上游 Python，产生 366 项错误；后续 F02 artifact 缺失为连带结果 | 两个 Ruff 入口精确排除 `third_party/vibe-trading/upstream-src`；完整干净检出复现全部 366 项，全部属于上游。原 145 个工程自有检查文件全部保留，新证据 producer 同样接受 Ruff 检查，自有未使用 import 仍被拒绝；Ruff 与 Pyright PASS |
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/37407823074) | 工作流仅安装 Node 依赖；A2 两条 Rust 语义命令要求 `--locked --offline`，干净运行器没有预取 Cargo 依赖。原任务只输出汇总失败，且未上传详细日志；同 SHA 主 CI 经 `cargo fetch --locked` 后在 Linux 的 A2 已 PASS | 在 A2 之前执行 `cargo fetch --locked`，保留离线测试和锁定版本约束；新增 `if: always()` 的 A2 semantics 日志归档。空 Cargo 缓存复现错误码 101；公开网络预取全部 327 个锁定依赖后，在全新编译目录执行两套离线 Rust 测试 PASS（14 lib + 12 reference）。下载过程使用临时网络参数重试，源码及工作流参数未改变；[原件](evidence/ci-5da474e-remediation-20261006/cold-offline-proof.json) |
| 同一范围的 pytest 潜在后续失败 | 根目录 pytest 还会发现 483 个上游测试文件，配置只安装 QuantOS Python 依赖 | 测试及覆盖入口显式使用已有 `engines/tests`，保留全部 17 个工程测试文件；未执行第三方测试 |

| 检查范围 | 实际结果 |
|---|---|
| Python 测试 / 覆盖 | 129/129 PASS；91.20%，原 85% 门槛保留；完整干净检出也为 129 PASS |
| 完整 F0/A1 | 87/87 PASS，21 节点 READY；[逐项执行明细](evidence/provider-a1-remediation-20261004/ci-cold-cache-lint-confirmed-20261006/execution-results.json) |
| A2 业务回归与严格内容门禁 | 14 Rust lib（另 1 F09 ignored）、12 reference、29 consumer；8 mutation 拒绝、22 契约负向、14 阶段正负、3 transport PASS；[当前 manifest](evidence/bff-fe-001-remediation-20261005/ci-cold-cache-lint-final-20261006/a2.json) |
| G0 工程 / FEP-0 聚合 | 16/16 与 2/2 PASS；[G0](evidence/frontend-g0-fep0-remediation-20261005/g0.json)、[FEP-0](evidence/fep0-remediation-20261005/ci-cold-cache-lint-final-20261006/fep0.json) |
| 当前门禁、计划与内容可携带性 | [最终验证索引](evidence/ci-5da474e-remediation-20261006/final-verification.json)；[证据摘要与 Git 跟踪检查](evidence/ci-5da474e-remediation-20261006/portability.json) |

套件有交叉，不累加为总验收用例数。87 项完整评估含三次独立跨语言构建、配置 Supabase Auth/PostgreSQL/Storage、事务反证与回滚、10,000-event、恢复/覆盖/服务及 browser/依赖检查；各项执行、目标及静态范围由原件单独标明。

## 三、问题清单及风险分析

两条 CI 根因及同一范围的 pytest 发现问题均已修复。只调整检查接线与归属范围；子模块 pin、第三方源码、业务 API、数据库迁移和权限均保持原值。Vibe 上游程序未运行，也未安装其应用依赖。修复前失败日志及冷缓存探针保留于[证据目录](evidence/ci-5da474e-remediation-20261006)。首轮评估在发现 pytest 范围问题后主动停止，未完成、未发布 READY；最终完整评估在 `dd8672c` 为 86 PASS / 1 FAIL：新增 audit producer 两处 Python 风格错误被 F08 拒绝，未发布 READY。格式修正后，实际重跑全仓 lint 与 F08 PASS；其余 85 项实际 PASS 原件复用，全 21 个功能输入逐项与干净 `dd8672c` 检出相等。原 87 项失败评估原件保留，当前 87 PASS 集合的[重执行来源](evidence/provider-a1-remediation-20261004/ci-cold-cache-lint-confirmed-20261006/reexecution-provenance.json)逐项记录时间、原日志摘要与复验结果；未把复用记录标记为新执行。

A2 本轮重新执行本地回归并绑定当前依赖，未重跑 MFA live。沿用 [fab00ba 目标原件](evidence/bff-fe-001-remediation-20261005/ci-live-20261006/receipt.json)：51 次调用、20 API、14 强断言、cleanupVerified=true；七项目标源码摘要与当前冻结源码一致，严格校验有效。Supabase 相关实际执行与本地静态检查分别记录；不建立本地数据库。

前轮 G0 原件及支持日志已[完整归档](evidence/frontend-g0-fep0-remediation-20261006-before-ci-5da474e/archive-index.json)。当前新范围 `sha256:09bcaf7f28d960843c63fa61649fc1fe7a22d265f8b9b545e09d6f7d35354587` 的[确认文稿](../gate-records/G0-user-confirmation-draft-2026-10-06-09bcaf7f28d9.md)已保存，历史批准和文稿原件保留；当前 G0/FEP-0 严格 READY 仍拒绝待确认状态。本次 CI 修复指令不等同范围批准，formal/RELEASE 不迁移。

## 四、整改建议与后续

推送本次提交后复核新的 hosted CI，重点确认完整子模块环境下 Python lint/test 和冷 Cargo 环境下 A2 语义执行；本机通过不代替 Linux hosted CI。持续保留精确上游边界、锁定依赖预取和失败 diagnostics，后续新增自有 Python 测试应放入既定工程测试目录。G0 范围确认、部署、真实 HTTPS/IdP、发布性能和同 SHA 正式验收按各自门禁推进。
