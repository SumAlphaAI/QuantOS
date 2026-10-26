# U01 执行报告 · 2026-10-26

当前功能开发 COMPLETED；工程 Gate **PASS_OWNED_LOCAL_U01_COMPOSITION**。完整联调 **PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN**；主计划 stage_gate 仍 INTEGRATION/NOT_ASSESSED。发布 NOT_RUN，formalAccepted=false，runtimeAdmission=DENIED。

冻结测试候选 `4d5362e1cca41a72f826c80e3c7f41f9c430f56d`。实现提交 `a3c12dea`，直接影响修复提交 `4d5362e1`。本目录后续封存提交只保存证据与封存工具修正，不把测试改绑到新 HEAD。receipt 保留原候选输入、全部命令/产物 hash，以及独立封存工具 hash。未推送、部署、外部发布或使用生产凭据。

## 变更

真实 Research 页面接入 768px 风险操作限制；异步预检后重核屏幕，缩屏关闭取消弹窗，已发出的写入保留已知回执。修复初次媒体查询后创建快照加载。C04 的 actual-worker Artifact 返回可定位 evidence，并同步 Strategy 注册路径父 Research 的 evidenceRefs。

新增 cfg(test) 本机宿主，将 reference C03 受理意图映射到实际 R03 coordinator/运行时/快照质量门禁、EngineManager 和自有 RD-Agent Python UDS，引擎产物原样由 C04 API 提供。真实页面验证创建、通知、终态重读、Artifact/Evidence/Snapshot/Audit 跳转、排队取消、断连显式恢复无重放、MFA failed/verified、壳导航和 noindex。代理未覆盖完成状态或产物。完整文件清单见 [changed-files.txt](changed-files.txt)。

## 命令与结果

手工复核 `node scripts/u01-review.mjs --verify`：PASS。本次13组命令共314个断言场景通过（Rust48、前端207、Node门禁54、Chromium5）；20条worker链包含在1个Rust集成测试内，不重复计入314。

| 组 | 实际命令 | 结果 |
| --- | --- | --- |
| host-build | `cargo test --locked --offline -p bff-gateway --lib --no-run --message-format=json` | PASS（编译） |
| worker-projection-regression | `cargo test --locked --offline -p bff-gateway --lib g3_research_tests::worker_to_registration_rejects_forgery_and_closes_twenty_causal_chains` | 1/1；实际20条worker链 |
| research-backend | `cargo test --locked --offline -p bff-gateway --lib research::tests::` | 24/24 |
| auth-backend | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider` | 17/17 |
| research-runtime | `cargo test --locked --offline -p quantos-runtime --lib research::` | 6/6 |
| frontend | `pnpm exec vitest run apps/terminal/tests/ui201.test.ts apps/terminal/tests/ui202.test.ts apps/terminal/tests/research-gateway.test.ts apps/terminal/tests/auth-bff.test.ts apps/terminal/tests/auth-poc.test.ts apps/terminal/tests/ui203.test.ts` | 207/207 |
| gate-tests | `node --test scripts/u01-review.test.mjs scripts/development-execution.test.mjs` | 54/54 |
| plans | `node scripts/check-development-plans.mjs` | PASS；159个stage仍NOT_ASSESSED |
| lint | `pnpm exec eslint apps/terminal/app/research/workspace.tsx apps/terminal/app/research/detail.tsx apps/terminal/src/research/runtime.ts apps/terminal/src/research/detail-runtime.ts apps/terminal/tests/ui201.test.ts apps/terminal/tests/ui202.test.ts tests/e2e/fixtures/u01-reference.ts tests/e2e/u01-integration.spec.ts playwright.u01.config.ts scripts/u01-review.mjs scripts/u01-review.test.mjs` | PASS |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | PASS；44条静态路由、181文件凭据扫描 |
| terminal-types | `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| browser | `pnpm exec playwright test --config playwright.u01.config.ts --project chromium --output docs/audit/evidence/u01-local-20261026/attempt-02/browser --reporter=list,json` | 5/5 Chromium；0 skipped/flaky |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:U01` | 预期exit 1；STAGE_NOT_READY |

精确命令、时间、退出码和日志摘要见 [executions.json](attempt-02/executions.json)；浏览器原始统计见 [report.json](attempt-02/report.json)，worker原始 record、取消回执、网络/二进制摘要和截图见 attempt-02/browser。运行时6项的准确范围是输入拒绝、语义/编码hash、幂等调度/checkpoint与仓库去重；运行中取消、deadline及进程恢复的Web全组合没有执行。排队取消在本次浏览器中实际交给R03取消，不能据此声称运行中引擎取消通过。

封存脚本修正后，另执行当前门禁30项和该脚本lint，均PASS；见 seal-gate-tests.log、seal-lint.log。未因工具修复重跑业务命令。

## 保留失败

- exploratory-01：沙箱EPERM禁止监听3190，浏览器未启动。
- exploratory-02：未冻结工作区，小屏hook首次判断后未触发快照读取，4场景超时；已修复。
- exploratory-03：未冻结工作区，测试将页面/research误用为API路径，1失败、4未运行；已修正测试。
- exploratory-04/05：未冻结工作区，MFA领域failed对应HTTP200，以及测试需等待异步回执；各4通过、1失败。exploratory-06仅补测MFA，1通过。
- attempt-01：候选a3c12dea；类型检查报告4个新增测试回调返回void错误，停止执行，浏览器和联调拒绝检查NOT_RUN。已修复并另立候选。
- attempt-02：全部命令达到预期退出码后，初次封存因二进制摘要前缀格式差异失败。修正工具后以`--seal`读取原始输入/日志，技术证据复核通过；原始失败事实见assessment-seal-failure.log。

探索目录里的sourceCommit是启动环境所给baseline，并非冻结工作区候选；不作为候选验收。没有删除旧失败、把停止项记PASS或拼接历史READY。

## 未决与下一任务

本机结果使用显式reference身份cookie桥、自签TLS/CORS、内存C03/C04和BFF→worker run映射；不证明真实OIDC、持久HTTP→R03队列、Supabase/Storage或部署目标。持久恢复、运行中取消/deadline/重启的Web组合、完整浏览器及人工可访问性、全仓联调、性能/长稳和同SHA远程CI仍待执行；历史G2 incomplete和原确认保持原范围。

完整U01/G2/R1联调不放行，发布NOT_RUN。下一原计划任务 **CORE:TP01** 的DEVELOPMENT入口实际允许；它不依赖新增整改编号，仍须在原任务范围补齐其业务集成义务。
