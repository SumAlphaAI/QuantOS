# ADR：TP09 TrendRadar 的限定参考评估

状态：QuantOS 工程设计记录；正式用户确认 **NO RECEIPT**。固定上游 `8ee26026ba6c11dec41a95fb3895a7162876caa1`，继续采用 **reference_only**。本轮结论不构成上游代码、数据、运行时或生产权限准入。

## 依据与问题

[官方固定提交](https://github.com/sansan0/TrendRadar/tree/8ee26026ba6c11dec41a95fb3895a7162876caa1)的文档描述热榜聚合、RSS、AI 分析和 MCP；这只是文档观察，未执行这些能力。[许可证](https://github.com/sansan0/TrendRadar/blob/8ee26026ba6c11dec41a95fb3895a7162876caa1/LICENSE)沿用 GPL-3.0-only 工程基线，QuantOS 策略禁止直接吸收其源码或依赖。此为工程准入决策，不宣称 GPL 普遍禁止商业使用，也不把软件许可解释为新闻或平台数据授权。

旧样本仅检查字段存在、读取预填不可交易标签，并误将 40 位 Git SHA 作为 SHA256。旧数据清单的“研究可用”标签没有真实逐来源授权依据。本轮保留旧文件快照，改为实际契约、哈希、执行结果和拒绝用例。

## 自有离线实验

1. 三组注册合成输入：热榜主题 3 条、RSS 主题 2 条、缺许可/来源主题 2 条；内容、域名和来源均由 QuantOS 自有测试定义。仅允许 `research` + `test`，真实输入、未知注册项、自述授权后重哈希、嵌套 order/venue/secret/approval 字段被拒绝。
2. 自有算法只计算条目数、最小排名和最大年龄；不是复现上游检测/排序/推断。缺许可或来源时保留 null，计算 degraded 与 missing_license/missing_source，不伪造补全。四种许可/来源组合全部不可交易。
3. 输出使用真实生成的 `quantos.strategy.v1.Signal` protobuf，确定性 wire 往返及 Node 独立 JSON Schema/字段映射验证。Signal 包含版本、置信度、15 分钟有效期、来源和 EvidenceRef。全部 FLAT、trade_executable=false；StrategyRelease/FeatureSnapshot 未解析，不接入 TP03 RPC 或交易消费链。
4. normalized/lineage 六份物理对象保存完整字节，Signal 引用对象哈希；输入/Schema/内容哈希独立重算。mock 引用不代表已接入 Artifact 服务、存储持久化或数据库。

## 数据与隔离 Gate

实际热榜/RSS/自定义 API/AI 数据全部 NOT_VERIFIED/DENIED；逐来源书面用途、再分发授权、真实来源字节与质量证据缺一不可。仅注册自有合成样本获得离线测试/研究例外，软件 GPL、可访问 URL、免费接口或托管平台不构成数据授权。

五份公开文件仅在内存核对真实 SHA-256/大小；不复制源码、文档正文或资产，不安装和执行依赖。参考 SPDX 记录文件 SHA256，包版本使用 Git SHA，不伪装 archive SHA256。当前 advisory 扫描 NOT_ASSESSED。生产构建、build manifest、当前源码及八份锁/声明排除该组件；任何依赖或对象库存出现 TrendRadar 均拒绝。

## 后果与验收边界

可移植输入是 Signal 质量/血缘/用途拒绝约束，而非可上线趋势数据源。TP03/F08/F05/F0 必须以本轮实际功能输入重新刷新；工程 PASS 不自动获得 DEVELOPMENT READY。正式 ACCEPTED、用户确认、同 SHA hosted CI、性能、真实模型/数据、生产隔离和发布均独立待验。下一步若接入真实数据，需先取得具体供应商/用途授权并实施可信数据接入和部署级权限控制。
