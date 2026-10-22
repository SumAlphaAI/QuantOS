# UI-204 DataSnapshot 功能规程

范围：C04 `listDataSnapshots` / `getDataSnapshot`。目录 `/data-snapshots`、资源 `/data-snapshots/:snapshotId`（声明式静态宿主映射）、兼容 `?snapshotId=`；UUID、重复/冲突参数必须在身份/数据请求前拒绝。Command 按 `snapshot.read` 显示入口。开发 Next 服务不提供动态资源别名；需使用查询引用或本仓静态服务，生产托管 rewrite 未验收。

页面先校验 C01 session/context 同一 actor/tenant/workspace/account/mode/environment/MFA/capabilities，并取最短有效期。要求 `snapshot.read`，只允许 research/paper/shadow，拒绝 challenged MFA。持续复用既有授权失效 SSE、5秒轮询与8秒最长未验证窗口。离线、隐藏、focus、撤权、过期、失联清除页面和所有结果，取消请求；显式重新验证仅重新读取，不重放业务动作。不持久化快照或用途结果，C04 读取显式 no-store。

目录过滤质量/快照ID、排序和分页全部发给服务端，不推断全局总量。不透明游标绑定原查询，有界50页；循环、重复行、超页、缺失items和未知质量拒绝，410刷新、429至少等待60秒显式重试，不自动重试。只显示当前页；更换查询丢弃游标及旧详情。403/401清空并失效；404统一不存在或无权访问。

只有 `quality=verified`、`qualityBlocked=false`、非空白许可标签、有效窗口和采集时间均通过才满足当前快照条件。所有其他质量（包括 provisional）、缺失阻断标记、未知质量/契约、空许可、未来采集、逆序窗口、窗口终点晚于采集、失效时间/溢出均阻断。时效截止取 `min(capturedAt, window.end) + maxAgeSeconds`，在截止点拒绝，后续用途核对重新读取最新详情再判断。服务端 true 永不被客户端覆盖。

“核对策略用途/核对交易用途”还要求对应 `strategy.write` / `execution.operate`，仅执行 C04 只读条件核对，返回 `SNAPSHOT_CHECK_ONLY_NOT_PURPOSE_AUTHORIZATION`。不创建研究任务/策略/交易，不传递可执行许可、跳过后端检查或宣称目标业务授权；后续任务在业务提交时必须再次执行服务端用途和资源授权。来源只展示 C04 sources，内容哈希为服务端提供，未作独立签名验签或捏造血缘图。

## 当前功能验证

`node scripts/ui204-review.mjs --run docs/audit/evidence/ui204-local-20261023/attempt-NN`：新目录、冻结本机工程 SHA，剥离环境凭据后仅执行110项直接功能/回归、terminal types/lint/build、6项本机Chromium、当前门禁/资源路由、计划、联调拒绝及下一开发入口。Command仅增加权限控制的快照链接，选UI-P02 presentation回归；route-access复用但当前页面接入，选28项直接回归。终端静态资源映射扩展必须保留audit/export原路由验证。一次构建不代表发布。

`node scripts/ui204-review.mjs --verify`：只读校验已保存命令、产物和源码摘要，不重新执行功能或全依赖链；工程证据与当前输入变化不得拼接成新候选通过。旧 UI-P12/UI-507 与历史边界只按原范围复用，不验收上游全部闭包。C01 current reference身份补报其已获授权的snapshot.read（其他身份不增加权限）；245项旧Rust输入中仅lib.rs与research_tests.rs变化，其余243项保持原样。重建当前reference二进制并执行受影响research_tests，原二进制保留历史SHA，不挪用为当前通过。G1辅助项不作为开发前置。

保留 reference cookie 身份/CORS loopback 代理替代、Firefox环境阻塞、WebKit拦截附件接收阻塞及所有历史NOT_RUN。degraded/expired、时钟/异常、网络/撤权等注入用例必须标记合成，不代表目标数据库、真实IdP或生产业务验收。未使用生产凭据，不推送、不部署。

UI-204当前功能 `IMPLEMENTED_PENDING_ACCEPTANCE`，人工确认待项目用户；所有阶段Gate仍NOT_ASSESSED，G1/FEP-1缺口不提升，正式/运行/发布不准入。下一原任务I2 UI-P05。
