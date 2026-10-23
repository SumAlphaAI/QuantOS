# UI-P07 回测详情与 Strategy Release

三条路由 `/backtests/:runId`、`/releases`、`/releases/:releaseId` 使用冻结 Terminal shell、语义 token 和亮暗主题。依据 `design/P07-Backtest-Detail-and-Strategy-Release-High-Fidelity-v1.png`：固定输入条、六指标、四页签、成本图与摘要、不可变包侧栏、审批时间线、目标卡。1672 桌面分栏、1024 堆叠双列侧栏、390 单列且表格区局部滚动。

## 真实数据映射

- 收益/回撤/Sharpe 卡片用明确标记 ≈ 的显示近似值；成本页签和原文保留全部原始比率/十进制字符串，成交数/费用/滑点保留原值，不以二进制浮点重写金额。没有净值、基准、回撤时序、逐笔时间或标的字段；页面明确缺项，不生成代用行情、收益曲线、时间和 Symbol。实际累计成本图仅由最多 2000 笔有效服务端 fill 的 fee/slippage 计算，按 execution_bar 索引，提供可访问数据表；非法方向、非有限数、负成本、bar 倒序/前视、溢出和超限均不画图。
- 概览/成交/成本/验证四个键盘页签，ArrowLeft/Right、Home/End；本地成交每页8笔，不触发交易。页签切换不卸载创建运行时，未知结果原键保留。
- Release 目录仅搜索当前服务端页，排序/分页仍走 C05。名称缺失显示 Release，不推算全局数量、版本、owner或风险状态。
- Release详情左侧报告须通过原有 assertReleaseReport 固定输入/参数/哈希核对及 C08 检查才展示；读取失败或撤权清除。右侧 immutable 内容可复制全文，完整原文保留。没有编辑 Release 接口。
- 审批时间线来自 C05 服务端事件并链接 C10 Audit；审批受理202不等于批准。本任务不提供审批决策UI。目标卡只展示后端 allowedTargets，只有批准、未过期、已核对且受支持的 Paper/Shadow 可选；选择仅本页内存。

## 开发验证和边界

`node scripts/ui-p07-review.mjs --preflight docs/audit/evidence/ui-p07-local-20261023/preflight-NN` 记录未冻结预检、失败与视觉种子，不能充当验收。冻结源码及18张基线后，`--run .../attempt-NN` 独立复验，`--verify` 检查命令、原始输出、SHA、全部文件摘要和当前计划。预检会写基线；最终运行严禁 `--update-snapshots`。

直接影响：UI302/303 runtime和页面、P06结构化草稿入口、真实C05 provider consumer、静态路由与拒绝门禁。Rust未改，复用UI303原binary；逐个核对全部Rust输入与binary摘要，不声称在新源码重建或重验21项Rust。reference宿主按本次GITHUB_SHA启动，服务制品来源另记c1774a74。

真实身份/MFA、cookie/CORS、数据库/Storage与跨进程恢复、生产hosting、Firefox/WebKit、人工读屏、原生200% zoom、跨OS、Storybook构建、远程CI、性能/容量/长稳、完整联调/发布与部署交易均 NOT_RUN。当前轮 axe incomplete 单列保留，自动扫描无法判断的图形/图标对比度不视为已验证。历史 UI302 12、P06 18、前次UI301回归12和原UI301 8条incomplete原样保留；这些是扫描记录数，未去重。新扫描独立记账。用户确认UI303只绑定原c1774a74及3a66e307，不给P07或新HEAD授予通过。

下一检查点 FRONTEND-GATE:G3 需组织完整I3业务链联调并复审CORE:S04；本次单页Gate不等于G3 READY。后续UI401功能开发可依分阶段规程独立推进。任何外部发布/生产凭据均需另行授权。
