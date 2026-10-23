# FEP-3 策略治理：独立功能范围与本地收口

本任务是原计划 I3 FEP-3，按其21项直接依赖独立核对 P06–P07、草稿、静态检查、回测、不可变 Release、审批申请/时间线及 Paper/Shadow 目标选择。源码/原范围确认仅作为引用，不重新授予 BFF、CORE、provider 或 G3 阶段 READY。FEP-3 development_status=COMPLETED 只表示当前前端功能收口；完整 G3、CORE:S04 与 FEP-3 联调仍未放行，159项阶段门禁不变。

| 范围 | 原范围证据 | 本轮功能验证与处置 |
| --- | --- | --- |
| Strategy Catalog / Lab / 版本化保存 | UI-301、UI-P06 | 实际 runtime/编辑缓冲；修复200保存回执只核对版本却未核对提交内容的问题。文件、金额字符串、数组顺序或类型变化不能推进版本/清除本地编辑；对象键顺序不制造冲突。未知回执只允许原键/原体重试。 |
| 静态检查 / 回测队列 / SSE / 报告 | UI-302、UI-P07 | 修复成功报告不可变基线漏掉 parameters；参数漂移拒绝，SSE不确认错误帧，报告清空并阻断Release。队列仍是本会话最多25项，202不是最终成功。 |
| 不可变Release / C08申请与时间线 / 目标 | UI-303、UI-P07 | 修复首次详情将Release参数与报告参数比较成自身而漏掉交叉绑定；报告不一致时不展示可用候选/目标。选择目标不发送部署/交易命令；拒绝、过期、只读、离线与撤权继续关闭。 |
| 研究证据 / owner交接 / 因果 | UI-P04、原G3、G3-INTEGRATION-01 | 复用各自已确认候选与原证据，逐文件保护失败、incomplete、NOT_RUN；不重复worker全链，不改绑为本候选执行。 |
| BFF-FE-000–011、S2-SERVICE、SERVICE:S04、G3 | 21项直接依赖逐项登记 | 仅原范围适用性参考；stage_gate仍NOT_ASSESSED。closes_core=CORE:S04保留映射，不宣称已关闭核心复审。 |

`fep3-fixture.ts` 是显式内存传输模型，使用真实前端 runtime、gateway、schema、reducer；完成状态、哈希、审批和重放由模型设定，不代表BFF/worker、密码学计算、数据库事务或资源释放。模型只服务 fixture.invalid，不访问网络。浏览器另使用真实本机 BFF 的不变二进制与当前前端构建；三个新用例明确篡改“浏览器收到的应答”，保存原/交付摘要或注入类型，不将注入数据称作服务端事实。原页面20条回归和18张既有P07基线按直接影响复验，不更新基线。

此次只改四个前端策略模块，通用结构比较函数不计算/替代原生hash，保留金额字符串类型与数组顺序。后端、Rust/Python、协议和依赖锁不变；复用原69候选的实际BFF二进制前核对源文件/锁文件未变及binary摘要，不能声称新Rust构建/测试通过。当前新增组合/拒绝测试、直接策略回归/真实consumer、Terminal类型/构建、改动lint、浏览器23条及功能/阶段反例均绑定本轮冻结输入。无全仓测试、F05/F07数据库campaign或上游递归重验。

以下不是当前功能假通过或新增开发前置：C05没有浏览器创建策略、全局队列、历史版本和比较接口，对应UI保持说明/禁用；真实Research HTTP持久队列、持续增量注册、Supabase/RLS/Storage/跨进程恢复、真实IdP/MFA/Cookie/CORS、目标性能/长稳/hosted CI/部署、Firefox/WebKit/跨OS、手工读屏/原生200%缩放及发布验收仍按原阶段记NOT_RUN。原全部incomplete不去重、不关闭，当前新浏览器axe的incomplete另列。

手工入口：`node scripts/fep3-function-review.mjs --run docs/audit/evidence/fep3-function-local-20261023/attempt-NN`；必须先提交冻结源码，每次新目录。`--verify`核查范围、原确认包字节、源码绑定、原始命令/退出/信号/日志、测试和浏览器数量及阶段拒绝。真实失败、沙箱端口限制和未运行项保留。功能结果不生成用户确认或完整G3放行，下一原计划开发任务UI-401。
