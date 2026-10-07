# BFF-FE-001：身份、会话与设置 API 当前复核报告

> 复核日期：2026-10-07；阶段：A2 DEVELOPMENT；工程冻结提交 `d00041ee354701a08fa7483e948b74f374439b13`。

## 一、任务完成概况

原六项业务整改继续CLOSED；本轮PROVIDER:A2复审新增的H-01成功状态、M-01执行提交溯源缺口均已修复，当前活动问题0。24项原控制点全部PASS；20个C01/C17 API实际目标成功覆盖完整，严格DEVELOPMENT门禁READY、formalAccepted=false。

旧当前报告保存在[历史原件](BFF-FE-001-before-provider-a2-remediation-2026-10-07.md)，原问题/失败尝试仍按既有历史链接保留。本轮窗口整改见[PROVIDER:A2当前报告](PROVIDER-A2-comprehensive-review-2026-10-07.md)。

## 二、完成明细与证据

| ID | 控制点 | 当前结果 |
|---|---|---|
| R01 | C01/C17 20 operation 发布 | PASS |
| R02 | OpenAPI/TS/Zod/MSW 同源 | PASS |
| R03 | P01/P15/owner/二期边界 | PASS |
| R04 | A2 live provider 可运行与覆盖 | PASS |
| R05 | session/context 与恢复 | PASS |
| R06 | profile/locale/theme 保存读回 | PASS |
| R07 | 通知偏好保存读回 | PASS |
| R08 | If-Match/版本冲突 | PASS |
| R09 | challenge 生命周期 | PASS |
| R10 | MFA 失败限流/冷却 | PASS |
| R11 | recent-auth/首因素授权范围 | PASS |
| R12 | logout/cookie/CSRF/Origin | PASS |
| R13 | 匿名访问申请 | PASS |
| R14 | 安全/会话/设备/下载/平台读取正确性 | PASS |
| R15 | 当前会话/最后有效因素保护 | PASS |
| R16 | 幂等响应与观测/审计关联 | PASS |
| R17 | 设备/因素撤销与注册幂等 | PASS |
| R18 | 撤销 SSE/实时失效 | PASS |
| R19 | 401/403/404/资源主体约束 | PASS |
| R20 | consumer runtime schema/default deny | PASS |
| R21 | 错误恢复/超时/取消 | PASS |
| R22 | A2 正负 Gate 的实际业务退化检出 | PASS |
| R23 | CI 接线/前置功能准入/输入绑定 | PASS |
| R24 | 版本/总结/历史与验收边界 | PASS |

本轮重跑三组provider/consumer语义、契约/阶段负向及8项业务变异。新增逐20API成功缺失、全500/401、SSE断言、缺失/未知提交与原提交源码不匹配等反例全部拒绝。当前回执绑定全部规范输入及三个前置依赖，见[当前功能回执](evidence/bff-fe-001-remediation-20261005/ci-47cb743-final-reassessment-20261007/a2.json)、[本轮真实原件负向探针](evidence/provider-a2-remediation-20261007/actual-receipt-negative-probes.json)。

原Supabase身份目标51次调用/20 API/14强断言、cleanupVerified=true，原执行提交`d758c839fbd57366346d0f2b9ef2081c68ab51e6`。七项目标源码与不可变提交及当前字节一致，本轮未重跑MFA/资料修改目标调用。环境为配置Supabase Auth/PostgreSQL + 本机live BFF、合成HTTPS Origin，不等于staging。源码/回执明细见[严格复核](evidence/ci-47cb743-remediation-20261007/closure-verification.json)。

当前全计划 26 READY、0 BLOCKED。项目用户已确认当前 G0 范围 `52fee5f6e499`，G0/FEP-0 严格 READY。

本轮 CI fixture 修复后，重新执行本任务语义/负向/变异并严格核验当前依赖；详见[CI 整改报告](CI-47cb743-remediation-2026-10-07.md)。旧当前报告快照保留，新候选 hosted CI 尚未执行。

## 三、问题与风险

当前活动问题：阻塞0、高危0、中危0、低危0。本次窗口门禁整改未修改身份业务实现、数据库迁移或OpenAPI；原权限、recent-auth、首因素/最后因素及恢复保护保持原验收范围。passkey/WebAuthn、完整consumer/UI链、Desktop、真实部署/IdP、hosted CI与RELEASE仍按对应阶段验收。

## 四、后续维护

持续执行 `pnpm check:bff-fe-001:development` 和阶段负向，窗口使用 `pnpm check:provider-a2`。功能输入或依赖变化后复评；允许文档变化时对可溯源、内容未变的旧目标证据进行复用。
