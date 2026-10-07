# BFF-FE-007：Audit 与导出 API 当前复核报告

> 复核日期：2026-10-07；阶段：A2 DEVELOPMENT；工程冻结提交 `d00041ee354701a08fa7483e948b74f374439b13`。

## 一、任务完成概况

原9项业务问题继续CLOSED；本轮PROVIDER:A2新增M-01执行提交溯源缺口已修复，当前活动问题0。31个原控制点全部PASS，完整完成率100%；六个C10 API正常/401/403实际目标覆盖完整，严格DEVELOPMENT门禁READY、formalAccepted=false。

旧报告保存在[本轮前原件](BFF-FE-007-before-provider-a2-remediation-2026-10-07.md)，原业务整改过程仍在[历史整改报告](BFF-FE-007-remediation-history-2026-10-07.md)和[初审](archive/BFF-FE-007-initial-review-2026-10-06.md)。本轮窗口整改见[PROVIDER:A2当前报告](PROVIDER-A2-comprehensive-review-2026-10-07.md)。

## 二、完成情况与证据

| ID | 原控制点 | 当前结果 |
|---|---|---|
| C01 | 六个 operation 与请求/响应 schema 发布 | PASS |
| C02 | C10 owner 与十个消费页面映射 | PASS |
| C03 | client/Zod/JSON Schema/MSW 同源生成及无漂移 | PASS |
| C04 | 参考搜索条件与有界 pageSize、sort/filter、时间输入 | PASS |
| C05 | 固定参考链的 correlation/causation 分页还原 | PASS |
| C06 | 六接口参考 cookie/capability 的 401/403 | PASS |
| C07 | 参考 create/cancel 的 CSRF、recent-auth | PASS |
| C08 | 参考敏感响应 no-store 与错误外观隐藏 | PASS |
| C09 | 完整业务意图的幂等、冲突与恢复 | PASS |
| C10 | 不透明且不可篡改、绑定查询的稳定游标 | PASS |
| C11 | 证据链完整性判定与真实因果覆盖 | PASS |
| C12 | 服务端字段级脱敏、禁止完整标识/秘密输出 | PASS |
| C13 | 真实 payload hash 与可验证证据摘要 | PASS |
| C14 | 六接口可由实际 live BFF 接收与处理 | PASS |
| C15 | F05 持久审计读模型及数据库功能连接 | PASS |
| C16 | 资源级主体/账号授权与无权资源隐藏 | PASS |
| C17 | 完整 ExportScope：eventKinds/time range/unique IDs | PASS |
| C18 | 持久异步导出、生成产物、重启恢复与取消工作流 | PASS |
| C19 | queued/generating/ready/cancel/expired/failed 状态机制 | PASS |
| C20 | 真实短时、一次性签名 URL、实际水印与文件元数据 | PASS |
| C21 | retention/到期拒绝与下载吊销联动 | PASS |
| C22 | 导出与受限访问全过程审计、持久可追溯 | PASS |
| C23 | 六个 typed gateway、cookie 与安全头携带 | PASS |
| C24 | 403/404/410 gateway 安全文案与 correlation 信息 | PASS |
| C25 | 成功响应 runtime schema 与安全约束校验 | PASS |
| C26 | 基础 transport 截止时间与写请求不自动重试 | PASS |
| C27 | 三项直接依赖的实际内容绑定 READY | PASS |
| C28 | 工程规范与既有本任务正负/业务/consumer 回归实际执行 | PASS |
| C29 | 任务级功能 manifest、输入/目标摘要与严格阶段 Gate | PASS |
| C30 | 六接口真实目标正常/安全负向/恢复/清理验收 | PASS |
| C31 | 请求资源限制与每主体/操作的配额 | PASS |

完整矩阵见[31项当前复核](evidence/provider-a2-remediation-20261007/audit-control-matrix.json)。本轮三组provider/consumer/门禁语义、5项业务变异实际执行通过，当前功能回执为[Audit回执](evidence/bff-fe-007-remediation-20261006/ci-47cb743-reassessment-20261007/development.json)。新源头溯源校验要求40位可解析commit对象，逐文件核对原Git字节及当前功能输入；缺失/未知/blob提交反例全部拒绝，见[真实原件负向探针](evidence/provider-a2-remediation-20261007/actual-receipt-negative-probes.json)。

原Supabase目标83次调用（含身份准备）/45执行断言、cleanupVerified=true，实际目标提交`5e3339c9e5cc95d550c6e67ffa36701998cb0e2f`。13项源码与原Git提交及当前内容一致，本轮未重跑Audit目标。持久审计、脱敏/摘要/分页、完整意图幂等、真实Storage字节/三格式产物、短时一次性下载、吊销/retention和生命周期审计保持原验收范围。源码及依赖见[严格复核记录](evidence/ci-47cb743-remediation-20261007/closure-verification.json)。

当前全计划 26 READY、0 BLOCKED。项目用户已确认当前 G0 范围 `52fee5f6e499`，G0/FEP-0 严格 READY。 A2聚合门禁严格READY。

本轮 CI fixture 修复后，重新执行本任务语义/负向/变异并严格核验当前依赖；详见[CI 整改报告](CI-47cb743-remediation-2026-10-07.md)。旧当前报告快照保留，新候选 hosted CI 尚未执行。

## 三、问题及验收边界

当前活动问题：阻塞0、高危0、中危0、低危0。本轮仅补强门禁与证据，未修改Audit业务实现、数据库迁移或OpenAPI。

查询限于authenticated actor授权账本及显式workspace/account scope；快照最大10000条、产物16 MiB、短时下载不超过5分钟，见[运行说明](../BFF-FE-007-runtime.md)。十消费页面完整联调、真实部署/IdP、目标规模五分钟还原、长稳、hosted CI与RELEASE正式验收仍在对应阶段执行，不以DEVELOPMENT READY代替ACCEPTED。

## 四、后续维护

保持 `pnpm check:bff-fe-007:development` 和A2聚合检查；源码、契约、规范计划或依赖变化后复评受影响回执。功能内容变化执行相应Supabase目标测试；功能字节不变允许保留原执行时间/提交进行内容绑定复用。
