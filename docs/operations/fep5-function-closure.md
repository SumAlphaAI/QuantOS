# FEP-5 风险与执行前端功能闭包

范围是本机前端功能与直接影响路径。开发状态 COMPLETED 表示 COMPLETED_FRONTEND_SCOPE；不表示 G5、I5 或完整 I6 联调完成。stage_gate 保持 NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。执行日志与源码/二进制/静态产物哈希在 docs/audit/evidence/fep5-function-local-20261024。

当前实现补齐交易审批 correlation、审批对象类型、Command 对象引用、同版本 Proposal 流与三个 C01 控制器权限快照的一致性检查。绑定变化清空旧审核授权；不确定提交保留原 key/body，只允许恢复原请求。strategy_release 审批响应仍采用 C08 操作 correlation；其类型不能授权交易 Command。桌面操作要求宽度至少 768px：Proposal 风险申请、Trade 风险/Command、Approval 签署/恢复和 Order 提交/撤单/恢复在小屏不呈现，已开弹窗关闭；控制器在 MFA/刷新后、实际发送前再次检查，保留只读事实。

## 本机矩阵

| 验证 | 实际执行与边界 |
| --- | --- |
| allow / deny / approval_required | bff-gateway execution 原生测试；不是用前端模型构造引擎 PASS |
| expired / stale | 同上，过期 Proposal/Command 与过时输入无下游创建 |
| duplicate | 实际 HTTP 原 key/body 额外重放 1,000 次，单 Command/单 Order；引擎组合亦验证幂等 |
| kill switch | 审批后真实风险拒绝，浏览器无成功回执、无 Order |
| Paper 因果链 | 实际 risk→独立 actor MFA/reauth→审批→Command→accepted Order→cancelled→当前 C10 完整链；reference 无成交，不伪造 Fill |
| 成交事实 | 原生 OMS 两个直接用例验证部分成交十进制累计、去重、拒绝原因及事件有效期；不声称浏览器获得真实 venue 成交 |
| 响应丢失 | 已提交 risk/Command/cancel 的显式运输丢失，原请求恢复；与提交前失败区分 |
| 损坏响应 | 显式修改浏览器所收 correlation，记录实际响应与交付响应哈希；不声称 BFF 产生坏数据 |
| Shadow 分支 | 实际 C15 rerun→不可改账本→C14 同 Run/sourceHash Performance→C10；手工改账 POST 返回 405 |
| 小屏 | 767 拒绝/768 恢复边界、390 只读；MFA/订单刷新中缩屏也不产生写入 |

Paper C09 执行与 Shadow C15 reference 的模式/订单标识来源不同；C15/C16 没有匹配的对账异常源。本次保持正确的拒绝，不降级 Shadow policy、不捏造关联 ID、不借用历史 PASS。两条正向真实接续为 NOT_RUN_INTEGRATION，见 FEP5-INTEGRATION-01/02。31 项直接依赖只索引原范围，不递归复验，不将原证据改绑本候选。

## 重现

仅 main；先本地提交源码，再执行：

```sh
node scripts/fep5-function-review.mjs --run docs/audit/evidence/fep5-function-local-20261024/attempt-NN
node scripts/fep5-function-review.mjs --verify
```

每次使用新目录，失败保留 failure.json、已执行日志与 NOT_RUN 列表；源变更须新提交、新 attempt。入口使用限定环境、离线 pnpm/Cargo 与实际 loopback Rust BFF、Chromium。不得加载生产凭据、连接目标数据库、直连 venue、推送或部署。记录二进制重建与静态构建输入，不复用旧二进制 PASS。≤5 分钟还原 SLA、真实 IdP/Cookie/CORS、Supabase/RLS/事务/Storage、持久化跨会话恢复、外部 venue、同 SHA 远程 CI、性能/容量/长稳、其他浏览器/读屏/原生缩放及发布均 NOT_RUN；发布义务按原 RELEASE 矩阵执行。

证据可以由 Codex形成技术文稿；没有本会话用户正式确认，不生成确认回执。下一开发任务 FE:UI-402，不将本次未决联调项变成其开发前置。
