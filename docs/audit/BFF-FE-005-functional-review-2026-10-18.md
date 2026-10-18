# FE:BFF-FE-005 / A3 当前功能复核

冻结源码 **e171fb7c1d3442a22626b8188319e6b9067f38e1**，814个输入、18组当前功能/直接影响检查与5个激活入口PASS；仅BFF005_SCOPE_LOCAL DEVELOPMENT READY。完整INTEGRATION/RELEASE=NOT_RUN、formalAccepted=false、runtimeAdmission=DENIED；用户确认PENDING。

本轮先记录项目用户对BFF003完整稿的明确原始回复并执行确认门禁，原稿/manifest与aeab72a5源码、963fd053原回执保持不可变，见[确认账本](evidence/bff-fe-003-confirmation-20261018/user-confirmation.json)。A2确认保持3f0c9bd5/013c20e8。五直接依赖为NOT_REVALIDATED/referenceOnly：BFF001、R01、R02、R1-SERVICE、A2；当前测试核对消费边界，不拼接旧READY。共享输入变化撤回BFF003独立Gate。

当前变更：

- Rust market投影补齐trade接收时间/身份/正价格与成交量、空白授权和JS安全sequence拒绝；book补齐相同授权/身份/sequence边界。
- reference watchlist在同一provider锁内追加一次脱敏canonical审计事实，auditRef/eventId/correlationId可沿C10查证；幂等重放不重复追加。live现有F05事务bridge、R02冷审批和租户lineage保持，目标未执行。
- MarketSeriesRecovery修改缓存/游标前核对instrumentId与provenance venue/非空来源授权；新增真实generated client→Rust丢响应后恢复、6并发重试、CAS/改意图拒绝、审计链、流重复/续传/切维度/注销拒绝。
- 新scoped recorder/Gate/scope与强制CI、Make/public aliases；同步两计划、分阶段与市场规程及旧闭包历史用途。旧57门禁仅隔离负向fixture，不执行完整闭包。

验证：

| 项目 | 当前结果 |
|---|---|
| Node | 229通过；旧证据/当前scope/确认/计划CI负向 |
| Rust | 52通过；market17、R01 clock1/book2、R02 policy2/snapshot1、A2 providers29 |
| consumer/契约 | 57通过，9文件；实际Rust loopback包含在内 |
| HTTP / Chromium | 50条、7 owned APIs，每项401/403；C10仅直接边界；基本venue切换通过 |
| 静态 | generated、types、lint、clippy、plans通过 |
| 激活入口 | development、CI、A2原确认、BFF003原确认、plans，5项通过 |
| 历史保护 | 52760个原audit/gate文件未改 |

详见[机器结果](evidence/bff-fe-005-local-20261018/review-results.json)、[当前manifest](evidence/bff-fe-005-local-20261018/manifest.json)、[24项控制点](evidence/bff-fe-005-local-20261018/control-matrix.json)、[输入/命令/日志](evidence/bff-fe-005-local-20261018/function-attempt-01/function-receipt.json)。状态码分布：{"200":12,"401":9,"403":10,"404":1,"409":5,"422":13}。

失败保留：[探索目录说明](evidence/bff-fe-005-local-20261018/exploratory/README.md)。修复前3个Rust回归与1个consumer回归失败；新夹具TS类型、路径参数及残留nodeId等失败均有原始日志。探索HTTP里的HEAD只是工作树基线，不作为验收源码；最终全部18组来自冻结源码新attempt，不混用探索PASS。

未决风险与移交：R01 B01/FA-H01及实时source-age/自然告警仍未关闭；本机陈旧数据degraded且报价不可执行，不等于真实行情健康。本轮无实际Supabase/Auth/RLS、持久跨进程事务/恢复、真实source许可与撤权或完整UI/API链；这些以及部署、安全/性能/长稳/同SHA hosted CI均NOT_RUN。真实市场目标矩阵仍需人工授权环境执行，专用自动化NOT_IMPLEMENTED，不提供虚构可执行脚本。原生工具启动停顿根因未定，不宣称产品性能验收。

未使用生产凭据、目标库、本地DB、外部发布或推送。下一可执行任务：先确认[本轮完整稿](evidence/bff-fe-005-local-20261018/confirmation-draft.md)，然后PROVIDER:A3当前功能汇总；不得复用旧42节点READY。精确变更文件见[清单](evidence/bff-fe-005-local-20261018/changed-files.json)。
