# BFF-FE-000 页面 BFF OpenAPI 基线复核报告

> 原始检查：2026-10-03；本次复核：2026-10-04（Asia/Shanghai）。
> 检查基线：`272aec4dd219915facf8abcfb9df95a059419108`；本轮文档修正及证据以包含本报告的提交为准。
> 结论：**13/13 工程问题已关闭；B-01 递延至最终评审，未正式验收。当前活动工程缺陷为 0，不能宣称原 14 项全部验收完成。**

## 一、任务完成概况

逐项重新核对原报告的 6 个高危、6 个中危、1 个低危问题，并重跑契约、兼容性、SSE、领域转换、参考 provider 和门禁负向检查。修复行为与当前证据一致。本轮另修正了活跃总结和任务卡仍沿用 API 1.4.0 / 51 schemas 的文档回退。

当前基线为 **OpenAPI 3.1 / API 1.5.0 / 62 published / 46 planned / 52 schemas**，覆盖 C01–C17、一期 22 页；六项生成资产无漂移。P16 仍为 Desktop 二期，46 个 planned operation 由后续 owner 交付，不计作 A1 缺失实现。

已解决问题的详细表现、定位和整改记录已移出本活跃报告，保存在 [历史发现与关闭索引](BFF-FE-000-findings-archive-2026-10-03.md)。原始报告逐字归档，旧失败日志及 manifest 未覆盖。当前执行清单、源码摘要和逐项状态见 [本轮证据](evidence/bff-fe-000-recheck-20261004/README.md)。

B-01 按用户要求及前端计划当前阶段划分，真实 staging 与联合签署在 **RELEASE / 最终评审** 执行，不阻塞当前工程开发或 REVIEW_READY；正式验收仍必须提供目标证据。`development_status=COMPLETED`、阶段 READY 与正式 ACCEPTED 分别记录，本轮不替代阶段依赖评估。

## 二、完成情况明细统计

| 口径 | 本轮结果 | 含义 |
|---|---:|---|
| 原高危 / 中危 / 低危 | 6/6、6/6、1/1 CLOSED | 全部工程问题关闭，含本轮活跃文档修正 |
| 适用工程问题 | **13/13，100%** | 当前活动工程缺陷 0 |
| 原 14 项问题处置 | 13 CLOSED、1 DEFERRED | B-01 未计作 CLOSED/PASS |
| 原 C01–C23 控制点 | **22/23，95.65%** | 22 PASS；C01 当前提交的 P0 同 SHA 回执为 PARTIAL |
| 原 C24 | DEFERRED_TO_FINAL_REVIEW | 开发阶段不纳入适用控制点分母；最终评审必须恢复检查 |
| 正式任务验收 | 0/1 | staging/签署未验收；不是代码完成率 |

C02–C23 对应版本与命名、会话/client、错误、分页、安全、幂等、版本、追踪、SSE、生成、领域转换、harness、敏感字段、兼容、测试与文档，均有本轮复核证据。C01 的准备/依赖结构检查通过，但干净检查基线的 P0 检查因缺当前 SHA 回执返回 FAIL；旧 `c0eced6` 等提交的回执不能继承，本次也未重新执行或宣称 P0/F06 目标验收通过。

| 本轮执行 | 结果 | 验证范围 |
|---|---|---|
| A1 开发/语义、OpenAPI、生成、覆盖清单、兼容 | PASS | 62 operation 的政策/default 错误及响应 header；可信历史兼容差异 |
| A1 原负向与整改/阶段负向 | 26/26 PASS | 原七类门禁退化拒绝；缺/篡改最终回执、错误阶段、过期决策拒绝 |
| API client | 61/61 PASS | 数据保真、真实 Proto 精度/枚举/UTC、SSE 网络恢复与撤权 |
| Contract / MSW | 25/25 PASS | 请求/响应 schema、cookie/CSRF、错误扩展、幂等和 correlation |
| Rust 参考 provider | 17/17 PASS | Auth/Settings 12、Audit/Export 5；版本冲突与幂等副作用 |
| 真实 loopback HTTP | 26 operation / 28 请求 PASS | C01/C17/C10 已实现参考接口的请求、状态、header 和响应反校验 |
| 独立 runtime schema 探针 | PASS | payload/parameters 深层保真；未知 SSE 版本、伪造 actor、debug 扩展拒绝 |
| 关键政策覆盖 | 178 测试 PASS；四项覆盖均 100% | 限于六个关键政策文件，不代表全部业务或目标环境通过 |
| 最终验收入口 | NOT_ACCEPTED（预期拒绝） | 缺真实 staging/签署，不能算验收 PASS |

本轮未连接数据库、部署或运行真实 staging。Rust 内存 provider、MSW、loopback HTTP 和本地覆盖率不能替代实际 Supabase、浏览器目标环境及发布回执。当前 HEAD 的远端 CI 未作为本轮验收依据。

## 三、当前待办与风险分析

| ID / 原等级 | 当前状态 | 待完成内容 | 影响与必需阶段 |
|---|---|---|---|
| B-01 / 阻塞级 | **DEFERRED_TO_FINAL_REVIEW / NOT_ACCEPTED** | 真实 staging 七类行为证据、完整源码 SHA/契约摘要/日志哈希、Product/Frontend/BFF/QA/Security/Risk/Domain 当期签署 | 不阻塞 DEVELOPMENT；最终 RELEASE 验收缺失则拒绝正式 ACCEPTED |

原高危、中危、低危活动问题均为 0，已关闭内容不再列作整改待办。B-01 的处理时机已经调整，实际环境验收尚未完成，不能把“递延”当作“已解决”。独立的依赖/回执待办为当前 P0 同 SHA 准入；正式 PROVIDER:A1/G0、阶段 READY 及页面/全量 API 准入仍依据其各自记录。

兼容性安全修正决策的工程准入有效期为 2026-11-03，继续由 owner 处理到期与迁移。后续 provider 必须兑现已经发布的分页、安全、版本、SSE 和错误行为；A1 基线检查不代为验收它们。

## 四、后续执行建议

1. 当前沿用 `pnpm check:bff-a1-development` 完成工程检查；按计划独立评估阶段输入和依赖，不能仅凭本报告把 `stage_gate` 改为 READY。
2. 需要当前提交的 P0/F06 准入时，先固定干净 SHA，再重新执行并写入对应 Git notes；目标数据库只使用已有 Supabase 配置。远端 CI 与 notes 发布另行核验，不复用旧提交的 PASS。
3. RELEASE / 最终评审取得真实 staging、当期签署和所需远端证据后，运行 `pnpm check:bff-a1-final-review`，再更新相应正式验收记录。
4. 后续问题继续新增独立证据；历史发现与失败记录保留在归档中，当前报告只维护活动状态和边界。
