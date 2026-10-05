# P0 / PREPARATION:P0 验收检查点全面复审报告

> 初审：2026-10-02；整改验收：2026-10-03（Asia/Shanghai）。
> 已接受源码：`0149e5681fde7c6b75f891f6708d63726f075fc9`；计划登记版本：3.14。
> 结论：**PASS，16/16＝100%，仅放行 A1。** 原 3 项问题全部关闭；当前未解决问题：阻塞 0、高危 0、中危 0、低危 0。

## 一、任务完成概况

依据[前端执行计划 P0](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-preparation-p0)、[核心计划](../SumAlpha-QuantOS-Development-Plan.md)、[Terminal 规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)及[网站与终端设计](../SumAlpha-QuantOS-Web-and-Terminal-Design.md)，完成六项 PRE、完整核心前置及阶段验收记录复核。

整改补齐关键契约测试的实际断言保障、同 SHA F06 目标验收与 P0 独立回执门禁。39 项联合检查全部通过；七项进程级反证全部按预期非零退出；直接连接已配置 Supabase 的 Auth/BFF/Runtime、Execution/Vault 和 PostgreSQL 拒绝矩阵通过。六项 PRE 均满足本阶段工程交付要求，16 个控制点全部通过。

本报告登记上述已接受源码，后续提交的准入仍以其自身 `refs/notes/f06-acceptance`、`refs/notes/p0-acceptance` 和干净工作树上的 `make f06-acceptance-gate`、`pnpm check:p0` 为准；历史回执不自动接受新 HEAD。审核身份为本轮用户授权的工程验证，不代表跨职能 owner 签字或指定模型复审。

原始发现、初审结论与证据保持不变，见[历史报告](./PREPARATION-P0-comprehensive-review-history-2026-10-02.md)；逐项修复见[整改记录](./PREPARATION-P0-remediation-2026-10-02.md)。本次[证据清单](./evidence/p0-preparation-remediation-20261002/source-0149e56/manifest.json)包含日志哈希、[P0 回执](./evidence/p0-preparation-remediation-20261002/source-0149e56/web/p0-receipt.json)与[F06 回执](./evidence/p0-preparation-remediation-20261002/source-0149e56/f06-target/f06-receipt.json)。

## 二、完成情况明细统计

沿用初审的 16 个等权控制点：PASS 计 1，PARTIAL/FAIL 计 0。当前 PASS 16、PARTIAL 0、FAIL 0；严格完成率 **100%**。六项 PRE 均有产物并通过复核，不按测试数量推算任务完成率。

| 编号 | 验收要求 | 当前结果与证据 | 状态 |
|---|---|---|---|
| C01 | P0 范围、依赖与 A1/G0/provider 边界 | 静态计划通过；实际回执限定 A1_ONLY | PASS |
| C02 | PRE-03/PRE-04 完整核心前置 | F01/F03 范围化接受记录保留；本次 F06 同 SHA 真实目标回执及门禁通过 | PASS |
| C03 | PRE-01 页面、Story 及七态覆盖 | 30 页面、132 Story、220 场景、30 追踪行；32 回归通过 | PASS |
| C04 | 角色、路由、风险、离线和安全一致 | 受控规则与 operation 追踪验证通过 | PASS |
| C05 | PRE-02 设计、WCAG 与安全 i18n | 252 对比度配对、18 安全 key、组件台账；27 回归及 Storybook 构建通过 | PASS |
| C06 | PRE-03 依赖、锁与双应用 PoC | 29 关键依赖、2349 运行时契约检查；双构建和 27 项正负测试通过 | PASS |
| C07 | 新源码 bootstrap/build/test ≤30 分钟 | 干净 Git 导出、冻结离线安装和宿主缓存；39 项累计 116.295 秒 | PASS |
| C08 | PRE-04 接口、字段、页面依赖 | 17 契约、23 个 P0 单元、383 字段；38 回归通过 | PASS |
| C09 | owner 与 mock 状态可追溯 | 17 契约责任角色及实施任务完整；62 已发布/46 计划能力边界明确 | PASS |
| C10 | PRE-05 三环境、身份与 mode 分离 | 三模板及 26 配置测试、10 门禁回归通过 | PASS |
| C11 | 缺配置 fail-fast、客户端秘密检查 | 配置负向与两应用 mock 构建产物扫描通过 | PASS |
| C12 | PRE-06 同源 schema/MSW 与 fixture | 62 操作/51 schema、10 fixture、17 contract；原 sabotage 检查通过 | PASS |
| C13 | 关键负向测试确实执行 | 17 门禁回归；七项进程反证均 exit 1；直接 Vitest 拒绝零断言 | PASS |
| C14 | 浏览器、基础 axe 与视觉基线 | macOS 六组 135/135；0 失败/跳过/flaky；24 PNG 完整性通过 | PASS |
| C15 | 覆盖率、性能与 CI 失败证据 | 全局行 81.27%；5 关键文件四维 100%；两应用预算通过；CI 接入 P0 政策回归 | PASS |
| C16 | 完整 SHA 验收与受限放行 | 16 项 P0 判定器测试通过；实际 F06/P0 notes 和双门禁 PASS | PASS |

| 验证层 | 实际结果 | 边界 |
|---|---|---|
| 六 PRE 联合重放 | 39/39 命令退出 0；187 单元、17 contract | Node 24.12.0 / pnpm 10.20.0；离线缓存安装，不宣称无缓存下载耗时 |
| 浏览器 | Terminal 81 + 官网 54＝135；retries=0、update-snapshots=none | macOS Chromium/Firefox/WebKit；Linux PNG 完整性不等于 Linux 执行 |
| 回归与反证 | PRE-06 17、P0 16；七项实际进程反证均成功拒绝 | 回调提前返回、死分支、未调用 helper、零断言及三个入口受检 |
| Auth/BFF/Runtime | 真实 Supabase Auth、独立数据库登录、cookie/权限/撤销通过 | 本地服务连接远端测试项目；合成 Origin 服务探针，不是线上浏览器部署验收 |
| Execution/Vault | 6 场景、8/8 SQL 角色拒绝通过 | Paper 路径；不宣称 X03 issuer/transport 验收 |
| PostgreSQL | 8 passed、0 failed、0 ignored；包含四类拒绝矩阵 | 真实配置目标；1 项开发者延迟诊断按既有政策排除 |
| F06 本地门禁 | 3 项身份/启动证据测试通过、1 项修复夹具测试跳过；5 项验收负向通过 | 跳过项不是必需目标矩阵，未记作执行成功 |

对应[联合命令](./evidence/p0-preparation-remediation-20261002/source-0149e56/web/commands.json)、[七项反证](./evidence/p0-preparation-remediation-20261002/source-0149e56/web/execution-negatives.json)、[目标运行](./evidence/p0-preparation-remediation-20261002/source-0149e56/f06-target/target-results.json)、[数据库日志](./evidence/p0-preparation-remediation-20261002/source-0149e56/f06-target/database.log)、[P0 门禁](./evidence/p0-preparation-remediation-20261002/source-0149e56/web/p0-acceptance-gate.log)和[F06 门禁](./evidence/p0-preparation-remediation-20261002/source-0149e56/web/f06-acceptance-gate.log)。

## 三、问题清单及风险分析

当前无未解决问题。原阻塞 B-01、高危 H-01、中危 M-01 均已关闭；详情移入整改记录及历史报告，不再列为待办。

保留以下验收边界：

- P0 只允许进入 A1；正式 G0、全部 provider 与页面联调、Desktop 不据此接受。
- 未执行远端 CI/Linux、三 profile × 双应用全部目标构建、线上部署或组织 owner 签署；已执行的 Supabase 目标范围仅为完整 F06 前置。
- 使用既有 Supabase 测试项目，无本地数据库、项目创建、schema 重置或迁移。Runtime 身份烟测临时使用 admin Storage key，未执行 Storage 操作；Execution 测试已清理数据并按既有脚本保留空测试 tenant。
- 回执是本地工程证据，哈希用于校验内容一致性，不代替独立签名。Git notes 与分支分别存储；只推送分支不会保证回执同步。

初次目标运行因缺少 `QUANTOS_TRACE_EXPORT_PATH` 在 BFF 启动时退出，补齐临时证据路径后在同一 SHA 完整重跑成功；[首次失败证据](./evidence/p0-preparation-remediation-20261002/source-0149e56/initial-target-failure/target-results.json)保留，不将失败日志改写为 PASS。

## 四、整改建议与维护要求

本轮整改已完成，无待修复项。后续每次改变提交身份，应依照[P0 验收规程](../P0-acceptance-runbook.md)重放联合检查、七项执行反证和真实目标链路，为新 HEAD 生成独立回执，再执行双门禁。不得用任务 COMPLETED、静态计划 PASS、旧回执或本地 mock 替代目标验收。

继续推进 A1 时保留正式 G0/provider 边界；向其他验收者交付时同步两个 notes ref，并在接收端重新校验当前 SHA。原始证据及本轮关闭证据按不可覆盖的历史记录保留。
