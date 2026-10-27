# FEP-8 当前前端收口与 M5 评审准备

结论为 **PREPARED_NOT_READY / NOT_READY_GAPS_OPEN**；FEP-8 仍 PARTIAL，G8 IN_REVIEW，159项 stage NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。本轮交付当前范围清点、六维审阅材料、19项缺口责任/关闭判据和可执行的只读核查，不签收完整 M5。

## 当前事实与必要整改

最新 G8 source `18408e7bca2ac3c64ab586b3a98dbeb64ec078d6` / seal `072fa539` 已实现 C09 1.17.0 显式 opt-in、与 C01 同作用域且8秒有效的默认关闭声明，实际 P10/P11 已展示关闭条件；P11 原 CSRF/key/body/command deadline、P10/P11 自有失权清理已整改。该包的原成功、失败、9项 Chromium、截图、两项 axe（Audit仍1项color-contrast incomplete/13节点）保持原SHA/范围，不能重绑成本轮 UI 复验。

旧 FEP-8 source `b75103a9` 的材料保留原字节，所述“server flag/capability absent”和“helper scenario-only”是当时事实；当前应区分 C09 默认关闭声明已实现、C11 activation 和原生正向执行权限仍缺失。最新 L4-SERVICE 也只是其自有原生服务范围，没有接上公共双审批/C09/C10 持久业务链。

本轮发现并修复采集器的来源错误：`fep8-provider-consumer.test.ts` 曾将 binarySourceCommit 写死为旧 `2d0eefc0`，不适合当前候选。现在输出使用专门的 `QUANTOS_FEP8_CURRENT_READ_DIR`，必须由冻结采集器提供完整 `QUANTOS_FEP8_BINARY_SOURCE_SHA`，记录实际 binary SHA256、当前 fixture/source SHA，以及实际 Request query/method/path 关联。新旧证据路径和 schema 分开，拒绝旧binary来源、跨作用域、假权限、缺query、写入或错误版本/有效期声明。

Paper 当前只读核查需证实：operator/approver/owner 的 C01 作用域与职责分离；C09声明默认关闭、无 venueSubmit、无业务写入；审批/订单列表空；Audit读权限有区分。Shadow保留实际 C09/审批/订单403，不能以声明存在或页面默认关闭声称 Shadow/C06 正向已完成。所有流量由 GET-only transport 限制，使用 reference Cookie 注入而非真实 IdP。

## 六维评审与19项移交

[机器评审包](../execution/fep8-current-m5-review.json)记录19项直接依赖的原计划状态及规范摘要；它们是库存与来源记录，不是本轮逐项验收。保留 `closes_core: CORE:L03/CORE:L04` 原映射，不表示关闭。每个原始 gap 的 ID、OPEN、原观察和最新进展均保留，另附原任务 owners、具体 closureCriterion；没有把本地默认关闭整改算作整个 gap 关闭。

| 维度 | 当前结论与重点 |
| --- | --- |
| Product | P10/P11关闭提示存在，Assisted Live 正向业务旅程未接通 |
| Frontend | 原SHA恢复/失权整改作为参考；本轮当前GET census，不冒充UI或人工复验 |
| BFF | C09版本化默认关闭成立；C11 activation、公共双审批原生执行权限缺失 |
| QA | 本轮消费者/权限/来源回归与原UI/原生分账，axe incomplete和全M5验收保留 |
| Security | reference身份、owned服务证明不能替代真实F06/IdP/Vault/数据库/生产签名验收 |
| Risk | C09/L01同源Command/Order及双审批→公共C10持久恢复尚未闭环 |

15项继承 gap 涉及 Research/Release→Proposal、Order/Fill→C15→C16、marker/source、C10 export、共享估值、HTTP inspect/repair、P13七服务历史、P14四契约、Shadow C06。G8四项涉及 C11权限开启、P10/P11正向、C09/L01接续和双审批/审计恢复。原50次双审批签名审计、200个venue映射、flag关闭及自批/超额/过期100%拒绝要求不降低；历史样本数不计本轮执行次数，当前目标验收NOT_RUN。

## 验证与冻结

使用 `node scripts/fep8-current-review.mjs --run docs/audit/evidence/fep8-current-local-20261027/attempt-NN`。先冻结候选，采集器核对Git输入，再用白名单环境/固定pnpm/Cargo locked offline构建实际BFF并执行当前Paper/Shadow GET census、C08/P11恢复/失权/声明直接模型回归、门禁反向测试、Terminal类型及定向lint、双计划核验和预期准入拒绝；记录实际命令、binary/输入/日志摘要。失败attempt不覆盖，末尾packet验证失败也保留诊断。`--verify` 不执行交易动作。

本轮未改页面、BFF/核心运行时或契约，故不重跑全浏览器、Web构建/axe、Rust原生测试、完整上游和数据库campaign；原结果只按原SHA参考，未执行不计PASS。当前UI、真实F06或双审批原生成功不属于这次只读census。当前限定源码/attempt进行gitleaks扫描并检查两个真实canary拒绝，不是全仓安全审计。

## Gate 与下一任务

工程 Gate `PASS_FEP8_CURRENT_SCOPE_AND_M5_REVIEW_PREPARATION` 仅以[冻结证据](../audit/evidence/fep8-current-local-20261027/README.md)为准；完整 FEP-8/G8 NOT_READY_GAPS_OPEN、M5 PREPARED_NOT_READY，正式确认 PENDING，不自行批准。本准备稿供六维审阅，不请求尚未就绪M5的批准。

下一原任务 **CORE:L03 DEVELOPMENT**：承接已存在 C09关闭声明，明确版本化 C11 activation 与公共C01/F06→服务双审批→原生签发的同源权限，接上P10/P11受控本机正向、拒绝与恢复，禁止把Paper/mock订单拼接为native订单；随后由CORE:L04完成公共C10/持久恢复与L01同源接续。当前CORE:L03 INTEGRATION仍拒绝。

真实IdP/MFA/Cookie/CORS、Vault/数据库迁移/RLS/事务/Storage、共同持久事实和跨进程多副本恢复、venue HTTP/signing/testnet、目标网络/轮换/通知/容量/安全/性能/持续窗口、同SHA hosted CI、人工读屏/原生200%缩放/全浏览器及RELEASE均NOT_RUN。未使用生产凭据，没有push、部署或外部发布。
