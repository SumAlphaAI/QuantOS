# CORE:S04 当前策略生命周期功能

2026-10-26，主计划第9节CORE:S04，当前main功能开发范围。使用现有S01–S04/C05/C08/C10与R03 owner入口，补齐当前审批消费缺陷并验证20条独立策略业务链。不执行历史依赖闭包、上游READY重授、全仓测试或F05/F07数据库/覆盖率campaign。历史G3和G3-INTEGRATION-01确认保持原SHA/原范围，不改绑本候选。

当前入口：

```sh
node scripts/core-s04-review.mjs --run docs/audit/evidence/core-s04-local-20261026/attempt-N
node scripts/core-s04-review.mjs --verify
node --test scripts/core-s04-review.test.mjs
```

## 当前修复

C08已经允许strategy_release的`request_info`，以rejected关闭审批并保留原动作和原因；P07的本地Release schema却只接受submitted/approve/reject，导致合法信息请求后刷新失败、候选与报告不再可读。现在承认该确切动作、保留有界reason并以React文本展示，保持原始固定参数/证据/哈希和已核验报告。明确显示“要求补充材料（request_info）”，后端状态仍rejected，目标关闭；不开放重新提交、审批权限、部署或交易。request_info与approved/pending等授权状态矛盾时拒绝，不因新增动作开放任意字符串。

后端拒绝和补充材料决策已要求非空reason；共享G3浏览器辅助函数补齐受控原因，不降低后端约束。新增真实C08→ReleaseRuntime消费检查及浏览器request_info、内容转义、刷新恢复、目标关闭和响应丢失后的原key/body/If-Match重试检查。重复受理只保留一次submitted时间线，202不代表批准。常规Playwright入口排除需专用宿主的S04套件，显式config单独运行。

## 当前矩阵与证据

- 20个独立Research与Strategy worker来源、独立策略/Release，通过真实R03/RD-Agent和StrategyLab Python UDS输出，生产owner类型安装入口核验后，由Web读取Research Artifact→Lab→静态检查→S02回测→不可变Release→独立参考审批actor/MFA→Paper/Shadow页面选择→Audit因果链。固定自有momentum模板和合成行情，不声称20种模型/算法覆盖。
- 拒绝、过期（受控时钟301秒）、20路并发审批（仅1次成功）、只读/离线恢复、request_info及提交响应丢失；所有场景无部署/订单请求。request_info原因含类似HTML的普通文本，按文本呈现。
- 直接回归UI301/UI302/UI303/P07共20个浏览器场景及18张明暗/1672/1024/390基线。首轮发现旧图未同步当前已有导航、比例格式和按实际成交bar绘制的成本曲线；复核后同步18张矩阵中2张1672宽报告基线，其余16张不变；完整旧图与原SHA/hash保存在visual-baseline-review-01/original。不提高容差；生成基线本身不记为比较通过，冻结候选以正常比较模式重新验证。新页面截图/axe自动检查只证明本机Chromium；incomplete逐项保留，不代表人工可访问性通过。
- 当前C05/C08必要拒绝、scope、幂等、不可变证据与审计单元；实际R03 worker来源与原子安装拒绝；SERVICE:S04的6个TCP/UDS测试覆盖真实生成、未验证/未审批/伪造、CAS和两类本地原生消费者。测试内配置票据是本地合成事实，不执行外部部署。
- 定向Web消费者、策略场景、身份/只读恢复、类型/静态检查、Node门禁和计划结构。仅Web产品变更，执行一轮新Terminal构建与客户端secret扫描，记录当前source/buildId/所有导出字节；无三轮构建或全仓复验。

执行器先验证所有源码输入已提交；新attempt保存原始日志、命令、起止时间/退出/信号和hash、真实宿主/普通BFF二进制hash、Web导出清单、原始结果/截图。环境白名单、固定离线工具，只使用loopback/UDS；拒绝私有app dotenv，不继承生产/数据库环境。实际数据库、外部数据/模型/部署没有运行。原始失败保留，不拼接旧PASS。

## 状态与未决项

当前开发功能完成的工程Gate为`PASS_OWNED_LOCAL_S04_STRATEGY_LIFECYCLE`；完整联调仍`PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN`，CORE:S04和G3阶段仍INTEGRATION/NOT_ASSESSED，development_status保留原IMPLEMENTED_PENDING_ACCEPTANCE正式流程状态。formalAccepted=false、runtimeAdmission=DENIED，没有自行签署正式ACCEPTED。

显式替代：reference身份cookie桥、临时自签TLS/CORS、独立控制会话的参考MFA、内存catalog与审计、cfg(test)受信宿主启动的研究worker与owner安装。Research页面提交HTTP→持久worker队列、持续增量catalog、真实身份与授权、Supabase/RLS/Storage/目标事务及跨进程恢复仍NOT_RUN。当前完整链始于受信测试宿主调度的实际R03研究，不冒充用户在Research页面提交的生产注册旅程。全部目标、性能/长稳、Firefox/WebKit/跨OS、屏幕阅读器/原生200%缩放、同SHA远程CI、发布验收仍NOT_RUN；旧G3 incomplete与历史未执行项保留。

下一可执行原任务：CORE-GATE:S2当前策略业务闭环评估（DEVELOPMENT）；其完整INTEGRATION及发布另按原范围证据执行。原任务范围内继续记录缺口，不新增阻塞无关功能的辅助前置项。
