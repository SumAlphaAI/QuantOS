# PREPARATION:P0 准备阶段功能准入复核（2026-10-18）

本轮 **P0_LOCAL DEVELOPMENT READY / A1_ONLY**。依据最新 AGENTS.md 核对六 PRE 当前实现和 A1 输入，完成必要功能门禁、PoC配置及输入完整性修复；不递归重验核心服务、不拼接历史 READY。完整联调与发布均 NOT_RUN，正式确认 PENDING，runtimeAdmission=DENIED。

- 基线：`4ccc508a8b477720334a75921474b1b62b4d4889`。
- 最终冻结源码：`538afeef3c056bd98d84d610375ed4b807c7634b`；第04轮独立执行24组全部PASS，1054个功能输入与六PRE/P0/A1规范输入绑定源码Git blob。
- 当前manifest：[`manifest.json`](./evidence/p0-local-20261018/manifest.json)，摘要 `sha256:192a6a441d5e0260989642b67088fa734e5fb9bd823dfa6d3c79e0e42aae1ee9`。
- [完整摘要](./evidence/p0-local-20261018/summary.json)、[执行命令/退出码/时间/日志摘要](./evidence/p0-local-20261018/function-attempt-04/execution-results.json)、[源码输入清单](./evidence/p0-local-20261018/function-attempt-04/inputs.json)、[人工确认文稿](./evidence/p0-local-20261018/confirmation-draft.md)。

## 当前实现与 A1 前置

| 范围 | 当前实现与本轮验证 |
| --- | --- |
| PRE-01 | 30页面单位，124页面Story+8流程Story，210七态+10流程场景，30追踪行；路由/角色/风险/API版本/owner及G0当前处置验证通过。 |
| PRE-02 | tokens/组件/财务样式/安全i18n齐备；252组对比度、18安全key、19共用/25领域组件行与7基线story通过；组件单测及Storybook构建通过。 |
| PRE-03 | Node24.12.0/pnpm10.20.0、29锁定直接依赖及2356运行时结构检查通过；新双Web产物、双路由浏览器渲染通过。干净导出无node_modules/私有dotenv，现有下载缓存条件下离线frozen/ignore-scripts安装、双Web构建、26配置+19UI测试和路由PoC用时27980ms，小于30分钟。 |
| PRE-04 | 17契约/17gap、23 P0页面单位、459字段行；当前OpenAPI70已发布operation/62schemas，Proto6文件/38message/15enum/2service/7rpc及50JSONSchema一致。字段、owner及Query/Command/Realtime映射无未定占位。 |
| PRE-05 | local-mock/local-integrated/staging三公共模板通过；必填/环境/模式/回调隔离与机密扫描拒绝测试通过，两个新Web客户端产物104文件扫描通过。未读取根私有dotenv。 |
| PRE-06 | fixture、CI/三浏览器注册、24跨平台视觉基线完整性与预算配置齐备；实际schema/auth/sensitive-field/PNG四类破坏均被检出，契约、策略覆盖、Chromium视觉/axe/OIDC PoC通过。 |
| A1输入 | 17契约组、22首期页面、70已发布+38计划operation清单与生成client/Zod/schema/MSW一致。不同页面计数是清单范围差异。38计划operation保持计划身份；核心X3能力不自动成为已发布BFF provider。仅放行A1当前功能工作，未授予A1/G0/FEP-0或全部provider READY。 |

六PRE在本轮消费者范围实际检查；`NOT_REVALIDATED/referenceOnly` 指其独立Gate及上游不重授READY，并非未测试当前六PRE功能。当前图P0一项READY，其余158项NOT_ASSESSED。历史正式P0 source/review/evidence不变；新候选没有正式P0/F06 notes，不提升为正式ACCEPTED。

## 代码、测试和规程修复

1. 新增独立功能门禁、当前范围清单与记录器。绑定冻结源码、规范输入、精确命令、超时、退出码和原始日志摘要；验证完整后事务发布，失败回滚计划与manifest。拒绝历史/漂移输入、漏项/伪命令、空测试、篡改日志/不安全路径及扩大准入/目标声明。
2. 修复PoC使用模板3100回调而实际监听3190的问题。公共mock构建与测试统一官网3196、Terminal/回调3190，增加误用回调的拒绝测试；产品重定向安全逻辑未放宽。
3. 原始日志先核对摘要，再去掉ANSI展示控制码解析测试结果；Node计数只接受真实摘要行，测试名称中的数字不能伪装摘要。
4. 新增PRE03干净Web导出检查，把pnpm声明的`patches/`纳入导出与源码输入，防止只验证锁文件而漏掉补丁。离线安装禁止依赖脚本，不访问生产或目标数据库。
5. 两开发计划、计划策略与验证器注册P0_LOCAL；修正规程的开发阶段递归默认。共享策略输入改变后撤回X3独立READY，保留其旧证据，未执行X3重验也不记其失败。

## 测试结果

本轮24组全部PASS；各组命令及原因见[范围脚本](../../scripts/p0-functional-scope.mjs)，不以子集替代任务交付。

| 检查 | 结果 |
| --- | --- |
| Node当前功能/门禁与计划回归 | 263 PASS：PRE01=43、PRE02=27、PRE03=29、PRE04=38、PRE05=10、PRE06=17、新门禁=39、原正式门禁拒绝=16、计划=44。 |
| 配置/UI/契约 | 26/19/28 PASS。 |
| PRE06关键策略覆盖 | 198 PASS、3 SKIPPED；六文件语句/分支/函数/行均100%。3项为TP03/TP04/TP05实际Engine→UI可选探针，本轮未设置其运行标志，未改记PASS。 |
| Chromium当前PoC | Terminal/OIDC11、官网8 PASS；含Command视觉、axe、390px只读/权限及mock PKCE成功/拒绝流程。 |
| 构建/静态 | 双Web编译、lint/typecheck、Storybook构建、锁/ADR/有效配置及客户端secret扫描通过。 |
| 干净Web workspace | 离线frozen bootstrap、双Web build、配置/UI test、双路由PoC与secret scan通过，27.98秒；缓存条件明确为既有pnpm store。 |

这些是分组执行计数，部分覆盖测试与组件测试重叠，不相加为唯一案例数。预算/CI/跨浏览器配置通过不等于实际性能/hosted CI/全矩阵通过。Storybook仍有大chunk构建提示，非正式性能验收。

## 历史、失败与范围

[范围历史](./evidence/p0-local-20261018/scope-history.json)保留：01轮两条OIDC成功路径失败及原始trace；02轮23组PASS但缺干净workspace证明，回执与发布manifest原件保留，由新完整范围替代；03轮漏带pnpm补丁，离线安装拒绝；04轮在新冻结源码完整执行24组，无历史日志拼接。[预检索引](./evidence/p0-local-20261018/preflight-index.json)保留未冻结期间的源码绑定失败等原始输出。

[历史保留证明](./evidence/p0-local-20261018/historical-preservation.json)：基线52,098个审计/门禁文件Git blob未变；历史正式签署不重绑新候选。未使用生产凭据、未连接数据库、未运行本地数据库/容器、未推送或外部发布。

## Gate、风险与下一步

- 功能实现：PASS；P0_LOCAL DEVELOPMENT READY，A1_ONLY。
- 完整业务联调、发布验收：NOT_RUN；runtimeAdmission=DENIED；正式确认PENDING，文稿已备，实际用户答复为空，Codex未自行批准。
- 未决：38计划API、三项Engine→UI探针、空下载缓存联网bootstrap、Firefox/WebKit/跨平台全矩阵、真实Supabase/OIDC/RLS/F06、完整页面/API业务链、性能/长稳/部署/同SHA hosted CI与正式验收仍分别留后续阶段。
- 下一可执行：**FE:BFF-FE-000 / A1 页面BFF OpenAPI基线当前功能复核**；按影响范围验证其直接前置、发布/计划operation与契约/生成/MSW、安全/错误/幂等/实时恢复，完成G0/FEP-0功能冻结范围。不得将本轮P0自动当作A1或全部provider准入。

源码修订提交依次为`75dcf0fb`（功能入口）、`a02de7d6`（PoC回调/解析修复）、`34986a2e`（干净Web标准）、`538afeef`（补丁完整性/摘要拒绝）；后续证据/计划提交不改绑源码SHA，不自动重验无关功能。完整[变更文件清单](./evidence/p0-local-20261018/changed-files.json)列出13个源码/规程/计划文件及本轮证据范围。

交付前读取门禁：`check:p0:development`与计划检查PASS；`--release`及冻结候选正式P0门禁按预期拒绝，缺用户实际答复的确认门禁拒绝。新增源码提交范围和暂存文本差异gitleaks均0发现；客户端104文件扫描PASS。原始结果见[post证据](./evidence/p0-local-20261018/post/check-results.json)与[扫描摘要](./evidence/p0-local-20261018/post/secret-scan-summary.json)。
