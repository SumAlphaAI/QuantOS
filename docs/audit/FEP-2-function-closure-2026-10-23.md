# I2 FEP-2 研究闭环：前端功能执行报告

本轮按原计划 FEP-2 收口前端既有功能，复用 G2 对七个研究页面及两个审计支持页面的确认/证据映射。不新增 G2 辅助开发前置，不重跑上游全链。当前应用、后端及共享运行时源码未改，新增前端组合测试、模型及手工门禁代码；这不是完整服务联调通过。

## 变更及缺口处置

- `apps/terminal/tests/fep2-fixture.ts` / `fep2-closure.test.ts`：同一显式内存传输模型，调用真实 Snapshot/Research/Detail/Artifact runtime、API client/gateway/schema；17条覆盖创建校验及原键重试、SSE续传/去重、取消未知结果与C03终态、撤权/关闭、父成员/hash与审计权限/保留期。
- `scripts/fep2-function-review.mjs` / `.test.mjs`、根 package 手工命令：冻结工程输入与当前日志，验证完整原证据包字节；负例拒绝假PASS、历史改绑、stage提升、辅助前置、命令遗漏/中断/替换与原始输出篡改。
- [实际规程](../operations/fep2-function-closure.md)：逐范围区分新测试/历史证据/实际服务未验证项；[当前账本](../execution/development-followups.json)仅完成 G2-EVIDENCE-01 前端范围映射，不关闭 G2-JOURNEY/RECOVERY/A11Y/TARGET。
- 前端执行计划仅 FEP-2 development_status 更新为 COMPLETED（前端功能收口范围）。159项 stage_gate、原规范依赖/验收要求、review_status 和 CORE 关闭状态不变。

## 验证与适用范围

工程冻结提交 **5bc04f5d400f0850bf0813550ea37a77a1334843**，310项输入，最终 attempt-01：17条前端组合测试＋140条门禁/策略测试全部通过（共157条）；8项命令均符合预期（7项exit 0，联调拒绝exit 1）。1,973个历史受控包文件保持原字节。同候选最终命令、退出码、源输入及日志以 [限定回执](./evidence/fep2-function-local-20261023/receipt.json) 为准。执行17条新组合测试、Terminal typecheck、当前门禁/开发执行规程反例、改动文件 ESLint 和计划结构检查；FEP-2与下一 UI-301 开发入口允许，独立联调入口 exit 1 / STAGE_NOT_READY 按预期拒绝。历史测试不重计为当前测试。

原始失败保留在 `preflight-01` 至 `preflight-06`：前两次模型审计路径/必填route缺失，第三次将no-store错误断言扩大到POST，第四次lint发现测试工具structuredClone全局声明；第五次计划链接提前指向尚未生成的回执，改为已存在证据索引；第六次相关检查通过。均属本轮测试/证据工具问题，无应用缺陷结论。早期预检没有冻结源码或执行清单，不能当作同SHA正式证据，详细记录见 [预检索引](./evidence/fep2-function-local-20261023/preflight-index.json)。最终工程冻结后另起 attempt，不覆盖预检。

新增测试仅验证前端消费者的组合一致性。终态、Artifact/Evidence、审计节点与因果关系由模型显式设定；模型去重不证明服务端事务幂等，关闭模型流不证明 worker 资源释放，未执行实际BFF/worker/数据库/Storage或固定输入真实重放。当前未改产品代码，原页面浏览器/视觉证据仅原范围复用，不对当前候选重授PASS；本轮不重建、不重跑浏览器、Rust、远程CI或整条依赖链。

## Gate、风险及下一任务

工程功能门禁为 `PASS_FEP2_FRONTEND_FUNCTION_CLOSURE`；仅前端功能执行 `COMPLETED_FRONTEND_SCOPE`、后续开发 ALLOWED。G1/FEP-1、G2/FEP-2 联调仍 `NOT_READY_GAPS_OPEN` / `INTEGRATION NOT_ASSESSED`，完整联调 `NOT_RUN_FULL_ACCEPTANCE`，发布 `NOT_RUN`；formalAccepted=false、runtimeAdmission=DENIED，无当前HEAD正式验收或用户自批。

保留 reference 身份/CORS 替代边界、Firefox环境阻塞、WebKit附件拦截阻塞，原6图标+2表头及P03/P04各12条 incomplete（不等于32个去重缺陷，P04节点76为跨扫描出现次数）、原确认和全部历史失败/NOT_RUN。真实服务取消/deadline/restart/replay/资源释放与持久审计一致性、真实身份/数据源/Storage、人工读屏/原生200%/完整目标浏览器、性能/长稳、远程同SHA CI和发布仍待独立执行。取消≤2s不以本轮测试时长替代。

下一原计划任务：**I3 FE:UI-301：Strategy目录与Lab草稿**，开发可执行；辅助缺口不作为其开发前置。无生产凭据、数据库操作、推送或部署。本地工程与证据提交见本目录README及Git历史。
