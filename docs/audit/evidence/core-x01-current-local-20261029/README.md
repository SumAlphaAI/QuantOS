# CORE:X01 DEVELOPMENT 当前成交账本

2026-10-29；基线`8ec5f2dd904026f9dae265f972d370ea74b8f2a4`。冻结源码`1601d98145a3d2d2f2e5df6d0d57648089cc8e41`的[attempt-01](./attempt-01/executions.json)共27项实际命令均达到预期；3项集成/发布拒绝退出1属于预期拒绝，不能算阶段通过。源码/输入/二进制/产物hash见[receipt](./receipt.json)，结果见[result](./result.json)。后续证据提交不改绑该源码回执。

工程Gate **PASS_CURRENT_NATIVE_FILL_DURABLE_LEDGER_UNKNOWN_ISOLATION**。实现IMPLEMENTED_PENDING_ACCEPTANCE；完整Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。19gap/8义务保持OPEN，159阶段/依赖/正式状态不提升。[评审文稿](./review-draft.md)待用户确认，未自行批准。

| 命令/验证 | 当前结果 |
| --- | --- |
| `node scripts/core-x01-current-review.mjs --run docs/audit/evidence/core-x01-current-local-20261029/attempt-01` | 27项达到预期，已冻结 |
| `cargo test --locked --offline -p quantos-portfolio --test native_ledger` | 10 PASS：精确费用/现金/位置、去重、错绑、整批拒绝、原币费用、UNKNOWN、anchor/恢复、旧无journal隔离 |
| `cargo test --locked --offline -p quantos-portfolio --lib --test x01_read_model` | 10 PASS；含1万成交黄金回放/重建，1个发布P95用例保留ignored，不能记作性能通过 |
| `cargo test --locked --offline -p quantos-execution --test core_x04_facts` | 7 PASS；实际两笔native Fill进入X01账本并恢复，费用0.2、数量1，重复不再入账 |
| 原生恢复 / 当前风险来源 / 公共来源 / mTLS进程 | 分别15、15、9、3 PASS；合计Rust69 PASS、1 ignored。原50审批样本保留，不等于50笔成交 |
| Vitest 当前消费者 / 全部契约与客户端 | 97 / 122 PASS，零skip；完整命令见executions.json |
| `node --test --test-reporter=tap scripts/core-x01-current-review.test.mjs scripts/development-execution.test.mjs` | 88 PASS，零skip，含ledger/checkpoint/source/UNKNOWN篡改拒绝 |
| Chromium `playwright.core-l4.config.ts`，单worker、零重试 | 4 PASS，正向旅程17.839秒；原30秒超时/60秒风险TTL/50样本不变 |
| Rust/Web构建、Clippy/fmt、TS/ESLint、生成一致性、OpenAPI、计划 | PASS；公共契约1.19.0，143 operations / 138 schemas，新增1个只读操作与3个schema |
| axe当前P11/C10/默认关闭 | 3次0 violation；C10 color-contrast仍有1 incomplete/9节点，不代表人工无障碍通过 |
| 当前差异/完整证据gitleaks及随机canary | 零未审定泄漏；精确owned幂等SHA256逐条分类，实际canary拒绝1次 |

[真实持久账本包](./attempt-01/native-ledger.json)绑定native facts、完整owner checkpoint、entry/source/ledger hash与当前scope。两BFF重启后12次原key请求只产生1次mTLS协议调用和1笔入账，费用0.01 USDT、位置1，重复查询不改写账本。缺失/损坏portfolio、原native来源缺失或被认证空内容替换均拒绝孤立投影；已有入账后新的旧风险Command在IO前拒绝。证明仅属自有单主机profile，不是Supabase/跨主机事务或真实venue资金账本。

[实际崩溃UNKNOWN包](./attempt-01/unknown-ledger.json)显示zone已执行1次协议调用、BFF响应丢失，恢复保留原Command、未入账的隔离义务及同一ledger；没有补发。appliedFillCount/费用/现金字段只描述已入账部分，不能据其零值推断未知订单零成交或零费用；consumerReady=false且valuationReady=false。

[P11截图](./attempt-01/browser/cases/core-l4-CORE-L4-current-P1-9f407-ommon-C10-read-and-recovery-chromium/core-l4-p11.png)与[C10截图](./attempt-01/browser/cases/core-l4-CORE-L4-current-P1-9f407-ommon-C10-read-and-recovery-chromium/core-l4-c10.png)已实看。P11可见已持久入账、entryHash、与native/C10相同的sourceHash，以及尚无可信估值/需新风险输入的说明；C10保持原5节点只读链。共享壳UNKNOWN/只读提示、人工读屏/200%缩放与全浏览器边界保留，详见[视觉记录](./visual-review.json)。

39份未冻结输入及原始日志完整保留。其中3份FAIL分别为正向费用样本超出精确Decimal表示范围、无Fill流程被过宽检查阻止，以及测试误期望缺失存储的新进程能启动返回HTTP；修复后对应测试通过，范围/样本数量未降低。初次类型迁移E0411只出现在工具输出，修复记录见[索引](./preflight-index.json)；不虚构其原始日志。process-02成功的UNKNOWN部分另存原件；见[失败记录](./failed-attempts.json)。当前冻结attempt-01无失败，X04原106文件逐个hash核验保持原范围。

当前只完成L4-LEDGER-01的X04→X01本机部分；X05独立books/对账、Alert持久闭环、可信mark/财务/新风险评估、异步venue回报、非报价币换算、真实IdP/MFA/Vault/Supabase/RLS/testnet、跨主机、目标P95/安全/负载/长稳/同SHA CI及完整联调/发布/M5均NOT_RUN，见[移交](./handoff.json)与[目标清单](./release-checklist.json)。未使用生产凭据或执行推送/部署/外部发布。

封存脚本首次复核曾误读X04 scope，属于封存索引错误，非冻结功能失败；[原错误输出](./seal-check-01.log)及原脚本保留，现已修正为X01并重新封存/复核。未修改或重跑冻结功能源码来掩盖该失败。

复核：`node scripts/core-x01-current-review.mjs --verify`；完整封存复核：`node docs/audit/evidence/core-x01-current-local-20261029/verify.mjs`。文件见[变更索引](./changed-files.json)与[完整manifest](./manifest.json)。

见[范围](../../../execution/core-x01-current-scope.json)与[规程](../../../operations/core-x01-current-ledger.md)。下一CORE:X05 DEVELOPMENT。
