# FE:FEP-8：前端范围收口与 M5 准备

仅QuantOS/main。FEP-8 development_status=PARTIAL，工程Gate `PASS_FEP8_FRONTEND_SCOPE_REVIEW_PREPARATION`限当前修复和已实现前端范围评估；FEP-8/G8 NOT_READY_GAPS_OPEN、M5 PREPARED_NOT_READY，formalAccepted=false、runtimeAdmission=DENIED。19项直接依赖与closes_core的L03/L04完整功能映射保持不变；159项stage_gate不提升。M5准备稿不是已批准的验收或运行许可。

## 当前修复与影响

C08原Intent没有保存CSRF：审批未知后重放会读取新token，MFA/reauth期间轮换也可携旧证明继续发送。新增测试在原实现复现两项失败，日志保留。现在从审阅时捕获CSRF，MFA/reauth使用同一token，在刷新后、MFA后、reauth后及实际decision发送/重放前校验；轮换或缺失调用失权处理并拒绝，decision请求使用冻结token。正常原key/body/版本恢复保留，不新建审批或Command。没有扩展Assisted Live模式或降低服务端验证。

新增16项显式进程内C08模型用例调用真实runtime/gateway/schema：原请求恢复、两种CSRF轮换、8种C01身份/权限变更、精确proof到期、非JSON401/403和close清理、条件入口交集。模型失权回调调用close，模拟实际页面monitor的关闭接线；不提供F06、双人签名、数据库或持久化证明。到期未知结果保留unknown且禁止重放，不伪装为拒绝或成功。

产品变更仅approval runtime。直接回归选UI504、P10、FEP5及G8拒绝/恢复；真实本机G8 Paper流程验证正常MFA、独立审批、三类丢失回执恢复/C10，仍是Paper/mock。另有Paper/Shadow各一个严格GET-only M5核查：角色分离、C11现有flag目录、C08/C09空列表、订单capability、C10 Reader边界；无新业务mutation或新mutation审计链。Shadow执行接口拒绝，不注入assisted身份冒充后端支持。

Rust/BFF源码未变，复用G8二进制：binarySourceCommit=2d0eefc0，fixtureSourceCommit绑定本次候选，不能把旧build SHA注入当前fixture。构建当前Terminal验证修复后的实际P10/P11，并运行原G8配置的7个直接浏览器用例；这些是当前候选重新执行，不改绑旧G8 PASS。原生L03/venue/执行测试只保留原G8范围，不因前端变更重复全链、Cargo或数据库campaign。

## M5材料与未决

[准备稿](./fep8-m5-review-preparation.md)和[机器材料](../execution/fep8-m5-review-package.json)覆盖Product、Frontend、BFF、QA、Security、Risk。它们是技术准备材料，不生成用户确认记录，不把本任务指令当验收确认；请求正式验收时仍依既有确认规程及完整技术门禁。

[范围清单](../execution/fep8-scope-assessment.json)原样继承G4/FEP4、G6/FEP6、P14、G7/FEP7及G8共19项缺口：server flag/capability、实际P10/P11 Assisted入口、C09→L01同源组合、双审批F06/HTTP→C10恢复仍未接通，CORE:L03/L04完整关闭不声明。其余Marker、导出、估值、研究/Release接续、Shadow C06、UI601/P13/P14契约缺口不关闭。准备材料建议NOT_READY，不将50组原生hash/MFA前缀fixture写成50次真实HTTP双审批或强签名证明；200个合成venue映射也不代表真实testnet。

原G8源码2d0eefc0、包eb90302e的81前端/HTTP、35原生、87门禁/路由、7 Chromium及181文件构建扫描以ORIGINAL_SCOPE_ONLY核对；当前调用旧用例的新执行另有候选SHA/命令/日志。旧失败与incomplete全部保留；当前/历史axe incomplete分别记录，不借M5材料关闭。真实IdP/Cookie/CORS、Supabase/RLS/事务/Storage/持久化审计、跨进程恢复、实际testnet/外部venue、同SHA远程CI、Firefox/WebKit/跨OS、手工读屏/原生200%、完整视觉、性能/容量/长稳及RELEASE均NOT_RUN。实际testnet明确NOT_RUN_USER_FORBIDS_CONNECTION，不推送、部署或发布。

## 重现与下一任务

先提交源码，再执行新attempt；失败原样保留，不覆盖旧目录：

```sh
node scripts/fep8-function-review.mjs --audit
node scripts/fep8-function-review.mjs --run docs/audit/evidence/fep8-function-local-20261024/attempt-NN
node scripts/fep8-function-review.mjs --verify
```

FEP-8/G8及CORE:L03 INTEGRATION预期拒绝；下一原任务CORE:L03的DEVELOPMENT可开展FUNCTION_AND_IMPACT本机实现/组合与缺口整改，不授权实际testnet、实盘、部署或发布。CORE:L04独立完成后才有完整L4/M5复审；本次不代做或提升这些阶段。
