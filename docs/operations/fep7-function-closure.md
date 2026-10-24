# FE:FEP-7：前端硬化、范围收口与 Beta 缺口评估

本次仅 main/QuantOS 的已实现前端范围；FEP-7 development_status=PARTIAL，工程 Gate `PASS_FEP7_FRONTEND_SCOPE_HARDENING` 不等于完整里程碑通过。FEP-7/G7 NOT_READY_GAPS_OPEN、Beta NOT_READY、159项stage_gate不提升；formalAccepted=false、runtimeAdmission=DENIED。没有正式确认回执，不关闭核心/Provider或发布准入。

## 当前硬化与范围

核对 FEP-7 的40项直接依赖（12项BFF基线、22个高保真页面、WEB-101、4项核心前置及G7）及源文件入口。页面清单是源码/原证据索引，不是22页面在本候选全部重新验收。全部依赖原Gate保持原状；本次不以现有页面标签或默认值推导完整业务成功。

新增17项显式进程内Performance模型测试，调用真实前端runtime/gateway/schema，但不访问BFF、Worker、F06、数据库，不提供签名或持久化证明。测试未知结果的原key/body恢复、actor/tenant/workspace/account/mode/environment/MFA/capabilities变更、offline、精确session到期、CSRF替换、非JSON401/403、C15 sourceHash不一致、交付期间下载deadline以及close清理。模型effect计数只限测试模型，不冒充后端幂等。现有UI403、FEP5、FEP6和路由访问测试作为直接权限/拒绝/恢复回归。

Paper/Shadow各启动一个当前fixture源码SHA校验的本机reference进程，执行严格GET-only消费者：C01/C02聚合、C04数据快照、C03空研究列表、C05/C06模式边界、C12市场来源、C17设置、C14/C15收益来源、C07/C08/C09列表、C16告警、C11来源/Admin目录及C10授权查询。Owner无audit:read，Operator无admin.write；Shadow C05/C06及执行列表拒绝，不制造正向源。通知EOF为disconnected，ack/source repair未执行；没有新业务写入或新mutation审计链。显式Cookie注入不等于真实IdP/Cookie/CORS。

本次产品运行代码未变、17项新拒绝探针原实现已通过，未虚构修复。复用G7 unchanged二进制，binarySourceCommit固定abc4c170，fixtureSourceCommit为本次冻结源码；拒绝把旧二进制build SHA注入当前fixture。若产品代码发生变化，impactCheck必须拒绝此范围，先重新声明直接影响与验证矩阵。未因文档收口触发Cargo重建、浏览器重跑或全仓campaign。

## 证据、Beta缺口和基线

完整保留[原G7缺口](../execution/frontend-g7-assessment.json)15项及既有development-followups，独立记录[本次范围评估](../execution/fep7-scope-assessment.json)。G4/FEP-4的Marker/导出/估值、G6/FEP-6的InspectEvidence/resolve/P13/P14四项、G7的HTTP队列到Worker、Release到Proposal、Paper Fill到账本、C15异常到Alert、Shadow C06正向来源全部不提升。参考fixture需要按现有Owner签名审查启用研究能力；本次仅读取，不尝试绕过或制造Workflow已完成。

原G7源码abc4c170、证据包6da93973及其attempt-02的35个前端/HTTP、52个原生、78项门禁/路由、18个Chromium和181文件构建secret扫描，逐项校验原输入/命令/哈希，均ORIGINAL_SCOPE_ONLY，不改绑当前候选。其2334个历史文件和G7整个包另作不变快照；预检失败、superseded-01、旧attempt和原始失败/incomplete/NOT_RUN均保留。

可访问性：G7两个Audit axe零violations，但2项color-contrast incomplete/26节点；P14原incomplete等不关闭。本次未改变布局，沿原视觉截图/兼容基线，不声称新Chromium/Firefox/WebKit/跨OS、手工读屏或原生200%缩放验收。未作数值性能、容量、长稳或恢复SLA测量，构建耗时不是性能基线。真实IdP、Supabase/RLS/事务/Storage/持久化审计、外部行情/venue、跨进程重启恢复、同SHA远程CI和RELEASE-GATE:BETA均NOT_RUN，不能判定功能阻断缺陷为全范围零。

## 重现和下一任务

先本地提交源文件，再使用新attempt（失败原样保留，禁止覆盖已有目录）：

```sh
node scripts/fep7-function-review.mjs --audit
node scripts/fep7-function-review.mjs --run docs/audit/evidence/fep7-function-local-20261024/attempt-NN
node scripts/fep7-function-review.mjs --verify
```

限定环境、离线依赖和loopback；无生产凭据、数据库连接、推送或发布。`--integration FE:FEP-7` 和 `--integration FRONTEND-GATE:G7` 预期拒绝；`--development FRONTEND-GATE:G8` 可执行。下一原任务为I10 FRONTEND-GATE:G8，仅本机testnet条件入口/flag/模式/MFA/职责分离与审计恢复评估，不代表实际testnet连接、运行或实盘授权；全部真实目标执行与发布另依原计划范围验收。
