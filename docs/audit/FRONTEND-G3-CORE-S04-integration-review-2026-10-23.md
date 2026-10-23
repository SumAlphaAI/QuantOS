# FRONTEND-GATE:G3 / CORE:S04 联调复审（2026-10-23）

**限定工程结果 PASS_G3_OWNED_LOCAL_COMPOSITION；完整 G3 与 CORE:S04 仍未放行。** 最终候选 `9a463495f7324b5f218bd3d0edd79baebb0f651c`，attempt-04；G3 review_status=IN_REVIEW，S04/FEP-3开发状态IMPLEMENTED_PENDING_ACCEPTANCE。当前所有159个阶段门禁保持NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，新确认稿PENDING。

## 执行与实际范围

依据前端计划G3/FEP-3、核心计划S04量化标准与分阶段规程，执行实际Python UDS产物、C04/C05/C08/C10页面和真实S01/S02/S03/S04本地进程组合，完成20个独立策略/Release旅程；执行owner-service TCP/原生adapter、拒绝/过期/竞争、权限/实时/错误/恢复及全仓功能测试。没有递归给全部上游重新发布READY，也没有用旧页确认替代G3。

20份StrategyDraftArtifact确由自有Strategy Lab UDS进程生成（相同momentum模板、不同自有请求标识），由仅cfg(test)编译宿主导入并注册20个独立策略。浏览器逐一查看研究Artifact元数据，再打开Lab、静态检查、真实S02回测及SSE报告、报告Artifact、不可变Release、审批受理、独立reference actor决策、允许目标选择，最后沿服务端correlationId进入Audit Explorer。20个策略ID和20个Release ID均唯一；报告/输入/参数/证据/source/image/hash逐项核对。不能外推20种市场/模型/算法。

审批竞争实际1成功/19个409，驳回与可信服务时钟过期状态均由服务端读取并阻断目标；只读/离线恢复不重放。前端没有自批或部署入口。owner-service另外生成102份产物，验证100次未验证/未审批拒绝、100来源伪造、20路CAS、会话/工作区/租户/能力拒绝、16事件作用域审计hash链及两种真实原生adapter重放消费。消费是本地配置票据，不是外部部署或交易。

C10页面显示的是本次提交correlation的授权范围完整链（实际1个节点），owner-service16事件链独立验证；不宣称全球研究→回测→Release因果图全部闭合。真实R03 Research worker到策略目录注册仍由可信宿主替代，未执行无替代旅程。reference身份/Cookie/CORS及审批MFA也属于显式替代；这些是G3联调边界，未以RELEASE外部性能移交掩盖。

## 当前缺陷修复

1. C05用serde JSON Number生成指标字符串，极小数输出科学计数法，违反DecimalString正则并使页面拒绝真实IPC报告。现对有限浮点用最短往返Display展开，整数保持原精度；极大/极小浮点、大整数、非数值拒绝测试补齐。
2. Python参数24.0经过JS变成24，被误认为不同参数而拒绝Release。仅对相等安全整数的表示等价；保存时还原可信输入原表示，Release响应取已核验报告参数。金额字符串、类型、键、数组顺序和非安全整数仍严格拒绝漂移，hash算法未改。
3. 人工检查真实C10长路由截图发现桌面固定15px行高使文字重叠；改为内容自适应，并对真实事件/对象引用上下边界增加不重叠断言。修复后截图已实际查看，未以axe零violation代替人工布局检查。

全仓还修复3处旧测试假设：ExportDownloadMetadata样例的受限URL、A2下载配置HTTPS来源及A6 HTTP前置拒绝错误；没有放宽生产下载策略。A2的HTTPS校验后本地HTTP传输替代明确披露。

## 命令与结果

[完整执行列表](evidence/frontend-g3-local-20261023/attempt-04/executions.json)、[全仓摘要](evidence/frontend-g3-local-20261023/whole-workspace-summary.json)、[覆盖矩阵](evidence/frontend-g3-local-20261023/coverage-matrix.json)。

```sh
node scripts/frontend-g3-review.mjs --continue docs/audit/evidence/frontend-g3-local-20261023/attempt-04
node scripts/frontend-g3-review.mjs --verify
```

| 检查 | 真实结果与版本 |
| --- | --- |
| engines/.venv/bin/python scripts/frontend-g3-produce.py | 最终候选实际20份IPC输出，0外部模型/凭据 |
| cargo build --locked --offline -p bff-gateway --bin bff-gateway；cargo test --lib --no-run --message-format=json | 构建命令通过，普通BFF和cfg(test)宿主摘要/候选记录 |
| cargo test --locked --offline -p quantos-strategy --test service_s04 -- --nocapture | 最终候选6/6，0 ignored；实际TCP/UDS及102产物，两消费者、16审计事件 |
| cargo test --workspace --locked --offline | **6ff11941原SHA**：99份harness摘要合计730 passed/14 ignored；原日志保留。Rust相关495个输入未变，后续未重跑、不改绑新SHA |
| engines/.venv/bin/python -m pytest engines/tests | **6ff11941原SHA**：1908 passed；Python相关210个输入未变，后续未重跑、不改绑新SHA |
| pnpm -r test | 最终候选1003 passed/3 skipped，7个Web项目，Terminal798；原失败保留 |
| node --test（G3/确认/执行/计划/路由） | 最终候选91/91 |
| pnpm --filter @sumalpha/terminal typecheck；ESLint；ruff；rustfmt | PASS |
| pnpm --filter @sumalpha/terminal build | PASS；buildId=terminal-9a463495f7324b5f218bd3d0edd79baebb0f651c；client-secret110文件通过 |
| pnpm exec playwright test --config=playwright.frontend-g3.config.ts --project=chromium --workers=1 --retries=0 ... | 44/44、0 skipped/flaky/retry；20新fixture+4拒绝/恢复+20既有回归；18已提交P07基线独立比较，无update参数 |
| axe自动扫描 | 36扫描，0 violations、36条incomplete，原始节点/原因保留 |
| node scripts/check-development-plans.mjs | PASS；159 NOT_ASSESSED |
| development-execution --integration FRONTEND-GATE:G3 / CORE:S04 | 均exit1，预期拒绝扩大阶段准入 |
| development-execution --development FE:UI-401 | allowed=true，仅允许下一原任务功能开发，不是G3 READY |

Rust14 ignored包括DB/性能用例、PostgreSQL恢复helper及cfg(test)浏览器宿主（该宿主另由24个UI测试显式运行）。缺数据库opt-in而harness返回成功的测试也不能计作数据库PASS。Web3 skipped不计通过。Rust/Python引用原SHA不是本轮新候选全仓通过；后续变化明确列在参考记录中，除Web呈现/测试/工具外任何来源漂移都拒绝复用。

## 证据与保留

最终1919源码输入、190个attempt产物均作摘要绑定；本轮不覆盖原P07确认及旧receipt。[失败目录](evidence/frontend-g3-local-20261023/exploratory/README.md)保留短SHA拒绝启动、真实DecimalString报告502、整数表示409、超时/孤儿进程清理及lint。attempt-01保留Web schema样例失败，attempt-02保留A2/A6失败与后续NOT_RUN。attempt-03自动44通过后发现的人工布局缺陷及原36条incomplete另存history；最终attempt-04独立浏览器复验。

当前36、前次G3 36、原P07当前22、UI303零、UI302 12、P06 18、前次UI301回归12和原UI301 8条incomplete分别保留，不去重、不声称关闭。全部历史NOT_RUN保留在[保留边界](evidence/frontend-g3-local-20261023/retained-boundaries.json)。

## Gate、风险与下一步

工程Gate只接受本地显式替代组合。完整G3/CORE:S04仍NOT_READY：真实R03 worker→owner注册、无替代身份链、完整跨模块因果证据与适用依赖阶段准入未闭合，新项目用户确认PENDING。真实IdP/MFA/cookie/CORS、Supabase/Storage/RLS/事务与跨进程恢复、生产hosting、Firefox/WebKit、人工读屏/native200%、跨OS、Storybook构建、远程同SHA CI、性能/容量/长稳和发布全部NOT_RUN。未安装/运行本地数据库，未使用生产凭据，未推送或发布。

下一闭环工作为G3-INTEGRATION-01：补实际R03 worker到目录注册及跨模块因果证据，不能用可信测试宿主代替完整G3。下一可独立执行的原计划功能为UI-401 Market Catalog/Watchlist/VenueQuote；不以G3未放行为无关功能开发新增前置。新[待确认文稿](evidence/frontend-g3-local-20261023/confirmation-draft.md)仅请求本轮限定证据范围，不授予G3 READY、运行时、生产或发布。
