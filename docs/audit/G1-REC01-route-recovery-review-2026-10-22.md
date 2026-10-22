# G1-REC-01 实际路由撤权、失效与恢复整改（2026-10-22）

**PASS_ROUTE_INVALIDATION_REFERENCE_SCOPE**；最终工程 `75451b08bf97f3b85d49d6f9eca9da23975e974a`、591项冻结输入。Command/Settings实际路由已接入授权SSE与有界C01复查，失效后清除私有投影/敏感草稿、取消在途请求并阻止迟到结果和后续写入，恢复先显式重新读取。**G1/FEP-1仍NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；本轮确认稿PENDING**。仅本机reference当前功能，不授完整联调、发布、I2或当前文档HEAD接受。

依据[前端计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)、[原缺口报告](./FRONTEND-G1-FEP1-local-gap-review-2026-10-22.md)和[已确认下载整改](./evidence/g1-download-confirmation-20261022/README.md)。[机器回执](./evidence/g1-recovery-local-20261022/receipt.json)、[恢复矩阵](./evidence/g1-recovery-local-20261022/recovery-matrix.json)、[源码定位](./evidence/g1-recovery-local-20261022/source-findings.json)、[最新整改状态](./evidence/g1-recovery-local-20261022/remediation-status.json)、[完整确认稿](./evidence/g1-recovery-local-20261022/confirmation-draft.md)。

## 实现与正确性边界

实际`/command`及`/settings/profile|security|notifications|browser`均使用共用访问监控。初次有序guard/private读取后先建立cookie-authenticated session SSE，再用C01 session/context重读匹配完整actor/tenant/workspace/account/mode/environment/MFA/capability集合，全部通过才发布私有UI。401/403/404与permission_revoked清空/阻断并跳转安全表面；流结束、异常、无效信封/UTF-8、超16Ki字符帧、未知事件、streamId变化不保留旧授权自动重连。普通remote session_revoked不更新权限或乐观删除业务资源；permission_revoked即使序号较旧也先失效。

服务端会话流的每用户消息使用全局sequence，因此这里将其作为失效通道而非业务投影reducer：数值gap不代表该用户丢事件，也不从消息授予权限。活跃时每5秒C01复查，整次复查最多3秒，权限观测有效期不晚于上次复查开始+8秒，并取当前session/context/资源最早期限。静默流不导致无限持有权限。同步assertCurrent在动作前/异步后检查期限、在线与可见性，弥补React或定时器延迟；后台隐藏立即清空。该窗口只针对浏览器前台执行模型，不等同目标撤权SLO、OS后台调度或性能验收。

离线/隐藏/窗口重新聚焦、跨标签页clear/set立即取消/关闭并清除当前私有UI；上线/可见后不恢复旧投影、不重放写入，用户显式验证重新读取。BroadcastChannel及瞬时storage fallback只携带version/type失效控制信号，无身份、token、权限授予或草稿；伪grant忽略，合法失效提示最多降低可用性。原sessionStore登录初始化现在能立即通知其他标签页，实际beginAuth用例中的mock.idp.local跳转在浏览器中阻断，没有访问真实IdP。

Settings正常有效授权刷新仍保留草稿、冻结写入。runtime对save/rebase/MFA challenge/reauth/DELETE/download建立访问和代际检查；旧save不能发布到新快照，过时challenge/reauth不能发下一个高风险请求。授权失效会卸载工作区，旧草稿不迁入新身份。**取消请求不表示服务端未提交，更不表示回滚**；未知结果/原幂等意图规则保留，后续按服务端事实核对，绝不自动重放。

业务Command摘要仍HTTP快照；本轮未接Command领域事实实时流。SSE缺失/不支持时安全拒绝发布，不作无限快照降级。没有修改Rust/provider生产接口、数据库或授权规则。运维代价为每活跃路由一条授权流和每5秒两次C01请求，目标连接容量/性能仍NOT_RUN。见[规程](../operations/g1-route-recovery.md)。

## 实际测试与证据

最终attempt-02的**11条限定命令全部exit0**：146单元/消费者（9文件）、15实际路由Chromium、6真实reference下载组合（含Chromium内容字节）、8既有mock路由回归、39门禁负向。零失败/skip/retry。必要构建按integrated/mock两种直接受影响模式各一轮；BFF只构建现有未改Rust源码作为reference测试宿主，不重跑无关Rust/DB campaign或上游全闭包。

15项实际路由包括reference登出SSE撤权3条、断流/显式恢复2条、合成C01 scope变化2条、Settings正常保稿/迟到读取、离线不重放、写入403、合成隐藏、真实BroadcastChannel、迟到初次Command、合成最早资源期限、真实登录初始化跨标签失效。测试代理是loopback fixture身份/CORS端口桥：未注入故障的JSON/流原字节转发；C01变化、403、最早期限、浏览器隐藏清楚标记synthetic。JSON只保存安全路径/状态/响应hash；SSE附件记录握手状态，不保存流原文。不能把所有浏览器结果称为真实目标权限或真实Cookie/CORS。

8项mock回归覆盖4分区渲染、通知降级、键盘focus、安全确认、390px/CSS zoom=2、离线清空/显式恢复、serious/critical axe检查及两张原Darwin Chromium视觉基线。PNG未改；CSS zoom不是原生200%，axe不是人工读屏，仍保留NOT_RUN。

| 检查 | 实际命令 | 结果 | 记录 |
|---|---|---|---|
| bff-build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/bff-build.log) |
| unit | `pnpm exec vitest run apps/terminal/tests/g1-route-access.test.ts apps/terminal/tests/ui101-source.test.ts apps/terminal/tests/ui101-runtime.test.ts apps/terminal/tests/ui104-runtime.test.ts apps/terminal/tests/ui-p15-runtime.test.ts apps/terminal/tests/ui-p17-runtime.test.ts apps/terminal/tests/auth-poc.test.ts apps/terminal/tests/auth-bff.test.ts apps/terminal/tests/g1-download-contract.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/g1-recovery-local-20261022/attempt-02/unit.json` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/unit.log) |
| types | `pnpm --filter @sumalpha/terminal typecheck` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/types.log) |
| lint | `pnpm exec eslint apps/terminal/src/auth/route-access.ts apps/terminal/src/auth/invalidation.ts apps/terminal/src/auth/flow.ts apps/terminal/src/settings/runtime.ts apps/terminal/app/command/ui101-command-route.tsx apps/terminal/app/settings/_components/ui104-settings-route.tsx apps/terminal/tests/g1-route-access.test.ts apps/terminal/tests/ui104-runtime.test.ts tests/e2e/g1-recovery.spec.ts playwright.g1-recovery.config.ts playwright.config.ts scripts/g1-recovery-review.mjs scripts/g1-recovery-review.test.mjs` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/lint.log) |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/terminal-build.log) |
| browser | `pnpm exec playwright test --config=playwright.g1-recovery.config.ts --project=chromium --retries=0 --workers=1 --reporter=list,json --output=docs/audit/evidence/g1-recovery-local-20261022/attempt-02/browser` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/browser.log) |
| download-regression | `pnpm exec vitest run tests/integration/g1-download-reference.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/g1-recovery-local-20261022/attempt-02/download/unit.json` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/download-regression.log) |
| mock-build | `pnpm --filter @sumalpha/terminal build` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/mock-build.log) |
| mock-browser | `pnpm exec playwright test --config=playwright.ui-p17.config.ts tests/e2e/ui104-settings.spec.ts --project=chromium --retries=0 --workers=1 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/g1-recovery-local-20261022/attempt-02/mock` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/mock-browser.log) |
| gate-negative | `node --test scripts/g1-recovery-review.test.mjs` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/gate-negative.log) |
| plans | `node scripts/check-development-plans.mjs` | exit 0 | [日志](./evidence/g1-recovery-local-20261022/attempt-02/plans.log) |

复核 `node scripts/g1-recovery-review.mjs --verify`；确认当前输入/命令/日志/二进制/构建ID/两种浏览器报告及每案JSON一致。旧DL工程354输入在原71b26d54核验，64+18原hash条目按各自证据提交核对，原确认仍仅原稿范围；旧源输入变化不改绑为新SHA通过。159个计划阶段与规范依赖/implementation状态不变。

原bd3d9fe4应用实现及9检查已通过，后续75451b08只更新直接受影响的mock测试、限定门禁和规程，另冻最终候选独立执行11检查；旧receipt保存在attempt-01。更早预检出现过不构成变化的环境fixture、10ms超时与50ms等待冲突、空解构lint；原失败和未完整捕获中间源码快照的局限均保留，不拼接预检通过。见[全部尝试](./evidence/g1-recovery-local-20261022/attempt-history.json)。

## Gate、风险与下一任务

G1-REC-01状态IMPLEMENTED_VERIFIED_LOCAL_REFERENCE，人工确认PENDING。DL-01/02仍按原工程CONFIRMED，当前额外下载直接回归不把原确认改绑新HEAD；原8项中3项本机工程已验证，其余5项（依赖适用性、P15确认、REC-02、浏览器环境、授权目标证据）保留。G1review_status仍CHANGES_REQUESTED，全部159 stage_gate仍NOT_ASSESSED。

Firefox BLOCKED_ENVIRONMENT、WebKit BLOCKED_ENVIRONMENT_TEST_INTERCEPTION及所有原NOT_RUN/失败/incomplete继续保留。旧HTTP_SNAPSHOT/未接stream记录仍是各自SHA事实，当前另记CONNECTED_REFERENCE_AUTHORIZATION_ONLY，不声称live或领域实时已通过。真实IdP/MFA/Cookie/CORS、目标DB/Storage/RLS、持久撤销、live授权流、完整页面/跨页面G1旅程、人工读屏/原生200%、原生通知、跨OS/设备、远程同SHA CI、性能/长稳、可信生产TLS与RELEASE均NOT_RUN。瞬时提示可降低可用性，不能授予权限；网络断开后敏感草稿主动清除，不承诺跨身份恢复。真实OS后台调度不在本机模拟证明范围内。[保留账本](./evidence/g1-recovery-local-20261022/retained-boundaries.json)嵌入原历史，不改旧包。

未读取生产凭据、未连接目标IdP/DB/Storage，无本地PostgreSQL/Supabase、推送或部署。下一可执行 **G1-REC-02**：同一候选完整登录→Command→P15→P17→导出内容、授权拒绝、审计correlation与恢复一致性旅程；P15原稿仍需独立确认，G1-DEP-01按实际影响登记，不机械复验全部上游。不提前授G1/FEP-1或I2联调READY。

## 变更文件

两个工程提交累计修改15个唯一文件（实现、直接测试、门禁与规程），后续另有此报告、证据包与计划同步；完整证据hash见[manifest](./evidence/g1-recovery-local-20261022/manifest.json)。

- `apps/terminal/app/command/ui101-command-route.tsx`
- `apps/terminal/app/settings/_components/ui104-settings-route.tsx`
- `apps/terminal/src/auth/flow.ts`
- `apps/terminal/src/auth/invalidation.ts`
- `apps/terminal/src/auth/route-access.ts`
- `apps/terminal/src/settings/runtime.ts`
- `apps/terminal/tests/g1-route-access.test.ts`
- `apps/terminal/tests/ui104-runtime.test.ts`
- `docs/operations/g1-route-recovery.md`
- `playwright.config.ts`
- `playwright.g1-recovery.config.ts`
- `scripts/g1-recovery-review.mjs`
- `scripts/g1-recovery-review.test.mjs`
- `tests/e2e/g1-recovery.spec.ts`
- `tests/e2e/ui104-settings.spec.ts`
