# FEP-2 研究闭环：前端功能收口

FEP-2 是 I2 原计划里程碑，覆盖 P03–P05 的 DataSnapshot 目录/详情、Research 列表/创建、详情/SSE/取消及 Artifact/Evidence 与审计跳转。复用 UI-204/UI-P05/UI-201/UI-P03/UI-202/UI-203/UI-P04，以及 UI-507/UI-P12 的原实现、原范围确认和 G2 缺口报告。当前应用源码未改，不新增产品功能；新增的是共用同一显式传输模型的前端组合测试和手工功能门禁代码。

## 当前范围与证据适用性

| 范围 | 当前验证 | 原范围复用 | 继续保留 |
| --- | --- | --- | --- |
| C02 Snapshot → C03 create/list | 实际 SnapshotRuntime 与 ResearchRuntime；选择后重新读取质量、许可、时效与创建 deadline；写入原键/原体重试 | UI-204/P05、UI-201/P03 | 模型快照、模型受理；不是服务端输入哈希计算或重放 |
| C03 detail/SSE/cancel | 实际 ResearchDetailRuntime、gateway、SSE reducer；显式续传去重、未知取消恢复、C03 终态权威、撤权清空/关闭 | UI-202/P04 | 模型事件与终态；实际 worker deadline、重启、资源释放、取消≤2s 未验收 |
| C03 → C04 Artifact/Evidence → C10 | 实际 ArtifactRuntime 与 schema/gateway；父成员/快照/hash拒绝、关联/因果引用、独立 audit:read、retention 过期 | UI-203/P04、UI-507/P12 | Artifact、Evidence、因果节点均由模型显式设定；不是实际 worker 输出、持久审计或独立验签 |
| 页面/浏览器/视觉 | 未改动应用，引用原 Chromium、截图、axe 结果 | 七页及两个审计支持原包 | 本轮浏览器/构建 NOT_RUN；Firefox/WebKit、人工读屏、原生200%及 incomplete 保留 |
| 依赖适用性 | 直接依赖22项，G2联合清单23项、原页确认7+审计支持2；逐文件绑定原 G2/页面包 | 891ec793 提交封存的 G2 清单与报告 | BFF/CORE/provider 原 stage_gate 不重授；CORE:U01/TP01 不声明关闭 |

`apps/terminal/tests/fep2-fixture.ts` 使用 `https://fixture.invalid` 的内存传输实现，不监听端口、不访问网络、不启动 BFF/worker/数据库。测试导入实际前端 runtime、gateway、API client 和契约；模型只提供输入和受控应答。`finish()` 明确设定模型终态/成员，模型去重计数不证明数据库幂等/原子性，关闭模型流不证明 worker 资源释放。测试没有伪装服务端事实，也没有用模型用例关闭 G2-JOURNEY-01 / G2-RECOVERY-01。

G2-EVIDENCE-01 仅在当前调度账本记为 ACCOUNTED_FRONTEND_FUNCTION_SCOPE，原 G2 报告/动作/回执/确认保持原字节；联调义务、环境义务和发布义务状态不变。以上是依赖/范围登记，无额外开发前置。功能状态 COMPLETED 仅指前端既有实现的功能收口；FEP-2 完整真实模块联调仍 NOT_RUN_FULL_ACCEPTANCE，G2/FEP-2 仍 NOT_READY_GAPS_OPEN / INTEGRATION NOT_ASSESSED。

## 实际入口

- 开发：`node scripts/development-execution.mjs --development FE:FEP-2`；下一原任务 `FE:UI-301` 同样允许开发。
- 冻结本机候选后执行：`pnpm assess:fep2:function docs/audit/evidence/fep2-function-local-20261023/attempt-NN`；复核：`pnpm check:fep2:function`。手工入口，不接入 push/PR/schedule 或 F05/F07 campaign。
- `pnpm check:fep2:integration` 当前按预期拒绝（exit 1 / STAGE_NOT_READY），不放宽 stage READY 规则。发布始终使用独立冻结候选流程。

本次仅执行新增17条组合测试、Terminal typecheck、门禁/执行策略反例、改动文件 lint 和计划结构检查。未修改应用、后端或共享运行时，不重跑旧页面/上游全链、Rust、构建或浏览器；原包只校验原字节与引用绑定，不把历史 PASS 绑定当前候选。

保留 reference 身份 EXPLICIT_REFERENCE_COOKIE_BRIDGE、CORS LOOPBACK_PROXY_SUBSTITUTION、Firefox BLOCKED_ENVIRONMENT、WebKit 附件接收 BLOCKED_ENVIRONMENT_TEST_INTERCEPTION；原6图标+2表头+P03十二条+P04十二条 incomplete，32是记录数而非去重缺陷数，P04的76为跨扫描节点出现次数。保留全部历史失败、NOT_RUN、人工确认和未执行项。真实 IdP/MFA/cookie/CORS、数据库/Storage、provider/worker/replay/restart、完整浏览器/跨OS、人工可访问性、远程同SHA CI、性能/长稳和发布均未验收。无生产凭据、数据库操作、推送、部署或外部发布；不授运行准入或正式 ACCEPTED，不生成虚假的用户确认。
