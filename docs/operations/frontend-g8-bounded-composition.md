# FRONTEND-GATE:G8：本机条件入口与职责分离组合评估

本轮仅QuantOS/main，实际testnet禁止连接，未使用生产凭据或数据库、未推送或发布。工程Gate `PASS_G8_OWNED_LOCAL_CONDITIONAL_COMPOSITION`仅指当前冻结源码的有界组合；G8 NOT_READY_GAPS_OPEN、IN_REVIEW，159阶段Gate保持原状，formalAccepted=false、runtimeAdmission=DENIED。FEP-8与L03/L04完整关闭未声明，无正式确认回执。

## 必要修复

`packages/domain-ui/src/strategy.ts` 的 assistedLiveGate 原先 flag=true 即返回reachable=true，即使server options没有assisted_live、列表为空或该目标被禁用。现在只在flag严格为true且有显式enabled=true的assisted_live目标时可达；否则保留关闭提示并排除该目标。非布尔truthy值也不开放。仅原flag=true/目标已启用的模型行为维持可达，不新建任何实际testnet路径。

共享helper目前仅被L03场景模型调用，实际P10/P11没有调用它；修复不是实际Assisted Live页面或HTTP链路交付。原始失败单元日志保留，预检中的Shadow只读加载假设和负向payload类型错误分别记录为测试问题，不冒充产品缺陷。

## 当前本机组合

- 条件入口模型：flag关闭/非布尔、空目标、只有Paper、禁用目标全部关闭；flag=true与服务端目标交集才可达。默认public构建flag=off，不是服务端权限。
- 原生 `quantos-execution::dual`：flag拒绝、50组独立双审批/100个审计entry、职责分离/额度/有效期/白名单等。只限原生owned fixture：MFA token前缀与ApprovalRecord内容hash不是F06认证或生产密码学签名证明，不能写成50次HTTP双审批通过。
- 原生 `venue`：200个ScenarioDrivenTransport映射及生产endpoint/key、网络/认证错误、精度/限流拒绝；仅内存合成传输，不连接配置中的testnet endpoint，不产生真实订单或Fill。
- 同一实际Rust reference进程：Paper风险→发起人自批前端拒绝和真实API403→错误MFA不发decision→独立Approver MFA/reauth→丢失已提交审批回执→原key/body恢复→非发起人Command拒绝、mode/flag注入422→Operator Command回执丢失/恢复→撤单回执丢失/恢复→唯一C10因果链。订单mode=paper、venueKind=mock、fills=[]，不得与原生testnet场景拼接成同一来源。
- C11允许列表不含testnet flag，Owner经MFA请求未知flag返回422且版本不变；Shadow执行API403、无写入。不创造新OpenAPI路径或放宽模式来制造flag开启的正向验收。
- 当前Chromium：2个G8用例覆盖实际Paper P10→P11→C10和显式交付assisted_live上下文的拒绝/非法入口零写；5个FEP5功能用例覆盖Kill、correlation和小屏拒绝。显式修改浏览器所收C01只属于消费者负向探针，原始BFF身份仍Paper。审批、Command、撤单三类回执运输丢失均单独标记；没有把丢失当后端失败。

## G8新增与继承未决

[机器清单](../execution/frontend-g8-assessment.json)继承G7/FEP7原15项、G4/FEP4/G6/FEP6/P14状态，并新增4项：服务端版本化testnet flag/capability未提供、实际P10/P11 Assisted Live正向未接通、C09到自有L01 adapter无同源连接、双审批HTTP/F06到C10/恢复未接通。没有因此判定整个G8已READY，局部Paper恢复不能关闭双审批或持久化恢复缺口。

真实IdP/Cookie/CORS、Supabase/RLS/事务/Storage/持久化审计、跨进程重启恢复、实际testnet和外部venue、同SHA远程CI、Firefox/WebKit/跨OS、手工读屏/原生200%缩放、完整视觉、性能/容量/长稳及RELEASE-GATE:LIVE-READINESS均NOT_RUN。用户明确禁止实际testnet，本轮不请求或使用外部运行许可。历史G4/G6/P14/G7/FEP7的失败、incomplete和NOT_RUN均ORIGINAL_SCOPE_ONLY，2500文件加FEP7包按实际快照核对；不重绑候选。

## 重现

先提交源文件，再用新attempt。修改共享helper的直接回归为L03场景与domain-ui测试；执行相关P10/P11 consumer、FEP5恢复和实际本机浏览器，不递归重跑全仓或全部Provider。构建当前Terminal供浏览器使用，原生仅选择dual/venue及BFF execution，不运行quantos-evidence中性能/SLO campaign或数据库工具。

```sh
node scripts/frontend-g8-review.mjs --run docs/audit/evidence/frontend-g8-local-20261024/attempt-NN
node scripts/frontend-g8-review.mjs --verify
```

失败使用新attempt并保留原始日志与NOT_RUN清单。下一原任务FE:FEP-8，开展前端范围收口/M5缺口评估；既有19项未决不自动关闭，实际testnet、实盘、部署和发布均不授权。
