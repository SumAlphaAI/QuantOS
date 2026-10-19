# FE:BFF-FE-006 / A4 当前功能交付（2026-10-19）

**BFF006_SCOPE_LOCAL / DEVELOPMENT READY**。冻结源码 `aad08dd50347d696409db84f86b080c26296a9c3`，999项输入、17/17组检查及5/5实际入口通过。功能实现PASS；完整业务联调和发布NOT_RUN；人工确认PENDING，formalAccepted=false，runtimeAdmission=DENIED。仅修改QuantOS，没有使用生产凭据、连接目标数据库、推送、部署或外部发布。

本次基于仓库已有20项API完成当前功能复核，未重复宣称原实现为新增。修复三组当前缺陷：

1. 装配原只核对投影与issuer实例关系，未完整核对财务tenant/account、Release tenant/workspace和issuer权限作用域；现统一校验风险policy、venue、财务quote unit，源替换失败不改当前投影/context。
2. 原页面预检调用X02 evaluate，Allow读取会登记seen并影响后续请求。现preview只计算、不登记；最终审批仍evaluate并由原子签发验证。测试覆盖连续Allow读取后成功审批/提交，并拒绝把preview当作可签发决策。
3. 原RiskView取首个Proposal，空Proposal时风险/Portfolio流返回404，kill变更后也无法返回正常风险响应。现使用同一X02账户规则和kill状态，独立于提案；覆盖无提案时查询、事件、engage/release及零下游提交。订单相关规则仍由preflight和签发验证。

另修复BFF006工具对旧OpenAPI1.8.0的等值锁定，支持兼容的1.x新增；当前1.12.0/132操作/110schema与六生成产物一致，仍严格检查本任务20项归属、请求/响应、权限和兼容性。当前发布目录改为20261019，原20261018 manifest、原确认稿/账本及失败记录均保持。

| 验证 | 当前结果 |
|---|---|
| Rust | 89 PASS：20 BFF执行、24 X03/TP07/X04、10风险、6共享审批、29 A2 |
| Node | 154 PASS：29原确认/流程、49门禁负向、76计划/CI负向 |
| 真实generated consumer与共享契约 | 49 PASS /8文件 |
| 实际HTTP | 20所属API/1085条，各成功/401/403；1000次同键重试 |
| 基本Chromium | PASS，API cookie/读与确认Order投影；完整页面NOT_RUN |
| 执行consumer覆盖 | 行25/25、分支33/33，均100% |
| types/lint/clippy/build/生成与兼容性 | PASS |
| 实际入口 | development、CI、A3原确认、直接前置引用、plans，5/5 PASS |

精确命令与结果如下；每组理由、时间、退出码、信号、超时、原始日志、输入和产物hash均在[manifest](./evidence/bff-fe-006-local-20261019/manifest.json)与[执行结果](./evidence/bff-fe-006-local-20261019/function-attempt-02/execution-results.json)。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-bff-fe-006-boundary.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| execution | `cargo test --locked --offline -p bff-gateway --lib execution::tests:: -- --test-threads=1` | PASS |
| issuer-oms | `cargo test --locked --offline -p quantos-execution --test x03_authority --test tp07_dispatch --test x04_oms -- --skip x04_one_hundred_thousand_mixed_kernel_events_replay_with_command_provenance` | PASS |
| risk | `cargo test --locked --offline -p quantos-risk --test x02_guard` | PASS |
| shared-approvals | `cargo test --locked --offline -p bff-gateway --lib a4_tests:: -- --test-threads=1` | PASS |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| http | `node scripts/test-bff-fe-006-http.mjs docs/audit/evidence/bff-fe-006-local-20261019/function-attempt-02/reference-http.json` | PASS |
| consumers | `pnpm exec vitest run apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/execution-recovery.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/execution/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/bff-fe-006-local-20261019/function-attempt-02/consumer-coverage` | PASS |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS |
| confirmation | `node --test scripts/provider-a3-confirmation.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS |
| gate-tests | `node --test scripts/bff-fe-006-functional-gate.test.mjs` | PASS |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |

总入口：`node scripts/record-bff-fe-006-functional.mjs docs/audit/evidence/bff-fe-006-local-20261019/function-attempt-02`，退出0；重放必须使用新的attempt目录，不能覆盖本轮。日常严格入口：`pnpm check:bff-fe-006:development`。只执行当前功能与有原因的直接回归；不递归重跑上游，不运行全仓或三轮构建。X04无关十万事件体量回放显式过滤1项，NOT_RUN而非PASS。

原源码63aaee15的attempt01因发现读取副作用而主动SIGTERM，A2组为INTERRUPTED；该候选未发布Gate、不借用其已通过项。新源码aad08dd5在attempt02完整执行17组，全部独立通过。初始跨计划/策略不一致日志及沙箱loopback EPERM保留；实际HTTP/浏览器在清除凭据的环境放宽loopback执行限制后通过。门禁测试里的假SHA git fatal为预期负向诊断，不是未关闭失败。

**未决风险与阶段边界**：执行host为受控单进程内存租约；实际Supabase/Auth/RLS/F05事务、持久跨实例/重启恢复、持续真实feed及身份/许可撤权、密钥托管、完整P08–P11/P20/G5/FEP-5链路、部署、安全/容量/性能/长稳与同候选hosted CI均NOT_RUN，归INTEGRATION/RELEASE-GATE:BETA实际验收。继承X01 f64与USD合成数据边界，真实财务精度/FX未验，非USD非零费用拒绝。本机READY不授予runtime、生产或外部发布权限。

十个前置均NOT_REVALIDATED/referenceOnly，不重新授予独立Gate；A3及FE006原确认仍只绑定原范围。计划保留IMPLEMENTED_PENDING_ACCEPTANCE，当前stage_gate=READY。原53,689份audit/gate文件[字节校验PASS](./evidence/bff-fe-006-local-20261019/history-preservation.json)。

变更文件见[完整清单](./evidence/bff-fe-006-local-20261019/changed-files.json)，验证归纳见[结果](./evidence/bff-fe-006-local-20261019/review-results.json)与[26项控制矩阵](./evidence/bff-fe-006-local-20261019/control-matrix.json)。依据[用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)，新的[完整确认稿](./evidence/bff-fe-006-local-20261019/confirmation-draft.md)待项目用户一人确认，Codex未自行批准。

本地实现提交：63aaee15（资源绑定/当前目录）、aad08dd5（风险读取/空态）。最终证据和计划提交另见Git HEAD，未推送。下一可执行任务：FE:BFF-FE-004 / A4（Strategy、Backtest与Release API）当前功能复核；沿直接影响范围验证，不重授上游Gate，不以本任务READY放行完整A4或发布。
