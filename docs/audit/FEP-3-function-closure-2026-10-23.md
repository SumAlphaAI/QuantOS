# I3 FEP-3：策略治理独立范围核对与本地功能收口

本轮完成前端功能收口，工程 Gate 为 `PASS_FEP3_FRONTEND_FUNCTION_CLOSURE`。计划仅将 FEP-3 development_status 更新为 COMPLETED；review_status 不提升，159项 stage_gate 全部仍为 NOT_ASSESSED。完整 G3 未放行，CORE:S04 仍 NOT_READY，formalAccepted=false、runtimeAdmission=DENIED。

工程提交 `1d9ae99a`；浏览器选择器修复 `d37041c4`；回执序列化工具修复及最终冻结候选 `0e30eb28509ee3adcf490350b65fe75d6e7ab331`。最终 attempt-03 的1,936项源码输入、12项命令、92件原始执行产物见[回执](./evidence/fep3-function-local-20261023/receipt.json)和[结果摘要](./evidence/fep3-function-local-20261023/verification.json)。本地证据提交独立于工程候选，不将历史结果改绑为本候选通过。

## 独立核对与缺口修复

按原计划的21项直接依赖逐项记录原要求、状态、用途和未授予的当前候选准入；closes_core=CORE:S04 只是复审映射。见[范围清单](./evidence/fep3-function-local-20261023/scope-audit.json)与[规程](../operations/fep3-function-closure.md)。BFF-FE-000–011、S2-SERVICE、SERVICE:S04 仅按当前消费路径引用，不递归重跑其上游 campaign。UI-P04、UI-301、UI-P06、UI-302（含 c61e1dc1 工具修复）、UI-303、UI-P07、原 G3、G3-INTEGRATION-01 共8份用户确认分别绑定其原工程/文稿/证据 SHA；2,090件原包及确认文件保持原字节，原源码输入及原manifest逐版本核查，不重授本轮验收。

| 当前缺口 | 修复与可观察结果 |
| --- | --- |
| 保存200回执版本正确但内容不匹配时可能推进本地版本、清除编辑 | `gateway.ts` 在变更缓冲前比较提交与回执的 files/parameters；异常保持未知状态与原意图，仅显式原键/原体重试。 |
| 成功回测报告的不可变基线未比较 parameters | `backtest-policy.ts` 对刷新及SSE校验加入参数；漂移后不确认错误序号、不展示报告，也不允许创建Release。 |
| 首次Release详情未交叉比较真实报告参数 | `release-policy.ts` 要求报告与候选参数一致；不一致时清空候选/报告/目标，申请审批前关闭。 |

`policy.ts` 复用对象键排序比较函数；它保留金额字符串/数字类型及数组顺序，不计算原生参数/Release哈希。`strategy-recovery.test.ts` 保留在途修改、旧版本及异常拒绝断言，纠正先篡改捕获描述符又接受不一致回执的旧测试假设。完整源码文件清单见[source-changed-files.txt](./evidence/fep3-function-local-20261023/source-changed-files.txt)。

## 实际验证

| 命令 | 最终结果 |
| --- | --- |
| `pnpm exec vitest run` 八个策略测试文件（完整参数见 executions.json） | 159/159；含18条新组合/拒绝用例及1条真实本机 BFF consumer 场景 |
| `node --test scripts/fep3-function-review.test.mjs scripts/development-execution.test.mjs scripts/development-plan-order-negative.mjs scripts/terminal-static-routes.test.mjs` | 151/151；拒绝范围、命令、退出码、信号、日志/产物篡改、阶段提升及跳过/重试伪装 |
| `pnpm --filter @sumalpha/terminal typecheck`、改动文件 `pnpm exec eslint …` | 均 exit 0 |
| `pnpm --filter @sumalpha/terminal build` | exit 0；buildId 精确绑定 0e30eb28 完整候选 |
| `pnpm exec playwright test --config=playwright.fep3-function.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=…/attempt-03/browser` | 23/23，零跳过/重试/不稳定；三个新故障用例＋20个直接回归，18张原P07视觉基线比较通过且未更新 |
| `node scripts/check-development-plans.mjs` | exit 0 |
| `node scripts/development-execution.mjs --integration` 分别检查 FE:FEP-3、FRONTEND-GATE:G3、CORE:S04 | 均 exit 1 / STAGE_NOT_READY，符合预期拒绝 |
| `node scripts/development-execution.mjs --development` 分别检查 FE:FEP-3、FE:UI-401 | 均允许 |
| `node scripts/fep3-function-review.mjs --verify` | 冻结源码、原范围引用、执行与产物核查通过；不是重新运行业务测试 |

真实localhost消费者/浏览器连接实际BFF；二进制 sha256 `4606288db2c83130f65a959ca201b6de8be524b23f67a71c62a7282baa0f6e94` 与696bef71原二进制相同，后端源码/锁文件未变。本轮未重建Rust或重跑Rust/Python工作区。构建与浏览器使用白名单环境，无目标数据库/生产凭据；TLS代理、身份桥接、CORS替代及独立reference审批控制保持明确标注，页面不发送部署或交易命令。

新组合测试的 `fep3-fixture.ts` 是显式内存模型，使用真实前端runtime/client/schema；其终态、哈希、审批和幂等重放由模型设定，不证明worker、原生哈希、数据库事务或资源释放。三个浏览器新用例明确篡改浏览器收到的应答；`fep3-fault.json` 标注注入，保存原/交付摘要或注入类型，服务端原字节仍由 `ui301.json` 单独记录。

## 失败、incomplete 与剩余义务

[预检索引](./evidence/fep3-function-local-20261023/preflight-index.json)保留5组未冻结探索：原产品7个反例失败、旧测试意图矛盾、新测试类型诊断、真实消费者沙箱 EPERM 及后续本机端口重试结果。预检不计为同SHA验收。冻结 attempt-01 保留浏览器1通过/1失败/21未执行及后续命令 NOT_RUN：实际参数漂移已被拒绝，但选择器同时匹配业务告警与Next路由播报；d37041c4修复选择器后另起 attempt-02，其全部12项命令符合预期，但回执JSON落盘省略了三个checkpoint的undefined开发状态，复读核查失败。原回执与内存核查摘要保留于attempt-02-postrun，未作为最终通过。0e30eb28规范记录UNSPECIFIED并补充落盘复读回归，再起attempt-03完整执行当前限定矩阵；最终另行--verify复读通过，未拼接前轮产物。

本轮34次axe扫描自动violations=0，仍产生34条color-contrast incomplete扫描记录；不等于34个去重缺陷，不自动关闭。原G3/worker各36、旧G3 attempt-03的36、P07的22、UI302的12、P06的18、旧UI301回归的12及原UI301的8，还有P04/P03和原6+2条等，均原文保留在各确认包，不合并或改写。全部历史NOT_RUN保持原值；历史R03 worker的原范围PASS另有原候选证据，不改写旧r03 NOT_RUN，也不声称本轮重跑。

真实Research HTTP持久队列、持续增量注册、跨进程恢复、Supabase/RLS/Storage、真实IdP/MFA/Cookie/CORS、完整多浏览器/跨OS/人工读屏/原生200%、性能/长稳、远端同SHA CI及正式发布继续保留NOT_RUN。浏览器创建策略、全局队列、历史版本/比较没有当前C05接口，UI维持说明或禁用，不自行编造实现。完整G3/CORE:S04未放行，本轮功能完成不替代正式确认或发布验收。

下一原计划可执行任务：**I4 FE:UI-401：Market Catalog、Watchlist、VenueQuote**。只在main生成本地提交；无生产凭据、数据库写入、远端推送、部署或发布。
