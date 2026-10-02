# R01 行情 provider 获取与审批配置指南

日期：2026-10-02。当前工程没有真实行情 provider URL、许可/审批记录；B01 的真实供应商验收仍为 NOT RUN。环境变量由工程运维配置，供应商提供的是数据入口、账号/授权或合同，不会向 QuantOS 颁发环境变量。

## 一、官方获取途径

| 需要 | 官方入口及申请方式 | QuantOS 接入边界 |
|---|---|---|
| Binance 公共现货行情 | [官方 Market Data Only 文档](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md)：REST base `https://data-api.binance.vision`，公共 WebSocket `wss://data-stream.binance.vision`；官方明确不需要认证/API Key。先由项目负责人确认可用地区、网络、使用条款及用途，再进行只读连通性验证 | 原生 REST/WebSocket 不是 ingestor 的 JSONL 协议；需要批准的 adapter。不要申请交易/提现权限 |
| Binance 历史行情 | [官方公共数据仓库说明](https://github.com/binance/binance-public-data)，下载入口 `https://data.binance.vision/`，按标的/日期选择数据、校验下载内容 | 转换 CSV/归档的时间单位、trade ID 与数值格式，作为历史数据使用；不能宣称实时 freshness 验收 |
| Coinbase 商业历史数据 | [官方 Data Marketplace 产品](https://help.coinbase.com/en/data-marketplace/getting-started/data-marketplace-products)包括逐笔成交与 OHLCV；通过官方 Marketplace/帮助中心的联系入口咨询购买、地区和授权范围。购买后按[官方 SFTP 下载说明](https://help.coinbase.com/en/data-marketplace/access-data/download-files)及关联的 SSH/连接教程取得账号、上传公钥、下载已购买产品 | 这是付费历史文件交付，不是低延迟实时 endpoint；合同与 SSH 私钥只进受控秘密配置 |
| LLMQuant 市场数据 MCP | [LLMQuant 项目](https://github.com/LLMQuant)、[data-mcp 仓库](https://github.com/LLMQuant/data-mcp)；在 [LLMQuant Data 官网](https://llmquantdata.com/)注册并进入 [Dashboard](https://llmquantdata.com/dashboard)创建 API Key，或生成 Remote MCP URL；具体流程见下节 | MCP 工具/REST 响应需由 adapter 转为 QuantOS 契约；历史 K 线、快照不能直接视为实时逐笔流或五秒 SLA |

公共可访问不自动等于允许商用、展示或再分发。必须保存适用条款或供应商书面授权，并由项目指定的数据负责人及法务/合规审核使用范围。上表是官方渠道信息，不代表已经替项目批准了供应商，也不保证当前部署网络可达。若选其他供应商，从其官网的数据产品/开发者门户申请只读 Market Data 账号，向销售/支持确认标的、实时或延迟、历史覆盖、速率限制、储存与再分发权限、费用和 SLA。

### 1.1 LLMQuant data-mcp：申请入口与流程

以下信息于 2026-10-02 核查公开官方文档；未登录个人账户或创建密钥。官网首页在本次自动抓取中返回 403，因此账号开通步骤依据官方文档，不声称已实测登录界面。

**申请入口：**

| 用途 | 具体入口 | 操作或联系对象 |
|---|---|---|
| 注册/登录 | [LLMQuant Data](https://llmquantdata.com/) | 注册或登录个人/团队获准使用的账号；官方 README 当前说明注册有免费 credits、无需绑卡，额度与计费处于 beta，以当时页面为准 |
| 创建 API Key | [Dashboard](https://llmquantdata.com/dashboard) → API Keys → Create API key | 自助创建，创建时复制一次；流程见[官方 Authentication](https://docs.llmquantdata.com/en/authentication) |
| 生成托管 MCP 连接 | [Dashboard](https://llmquantdata.com/dashboard) → Connect → Remote MCP URL | 生成专属连接 URL；流程见[官方 MCP Server](https://docs.llmquantdata.com/en/integration/mcp-server) |
| 接入问题/功能请求 | [data-mcp Issues](https://github.com/LLMQuant/data-mcp/issues/new)；`contact@llmquant.com` | 仓库 README 列出的支持渠道；额度提升、商用/存储/再分发及 SLA 可通过该邮箱咨询，不应假设存在已公开的企业申请表 |
| 项目通用联系 | [LLMQuant 组织主页](https://github.com/LLMQuant)列出的 `info@llmquant.com` | 项目合作或支持渠道无法响应时咨询；不要把公开 GitHub Issue 当作提交密钥或合同的入口 |

**自助申请与开通：**

1. 明确所需市场、标的、历史区间/频率及用途，先核对[官方 Market Coverage](https://docs.llmquantdata.com/en/market-coverage)。当前行情工具包括 `crypto_historical_klines`、`crypto_snapshot`、`equity_historical_prices`、`equity_intraday_prices`；公开覆盖说明列出 crypto 1h/4h/1d/1w K 线，以及美股日线和短窗口 1h 常规交易时段数据。不要假定覆盖所有市场、逐笔成交或交易所级实时流。
2. 从官网注册/登录，打开 Dashboard → API Keys → Create API key，创建并妥善保存密钥。将其作为 **`LLMQUANT_API_KEY`** 交给 MCP 进程或 adapter；这是 LLMQuant 的实际配置变量，当前 market-ingestor 不直接读取它。官方 REST 使用 `Authorization: Bearer` 请求头。获取密钥是自助开通，不等于 QuantOS 内部数据许可批准。[认证依据](https://docs.llmquantdata.com/en/authentication)
3. 选择一种连接方式：本地 stdio 使用官方 npm 包 `@llmquant/data-mcp`；需要托管 MCP 时，在 Dashboard → Connect 生成完整 `https://mcp.llmquantdata.com/u/lqd_mcp_.../mcp` URL，配置到支持该远程传输的 MCP 客户端。Remote URL 与 API Key 独立、可单独撤销，URL 本身含访问秘密，应按密码保管。[接入依据](https://docs.llmquantdata.com/en/integration/mcp-server)
4. 按官方工具参数执行一个最小只读查询，确认响应、数据时间、覆盖范围及 credits 消耗，再按需要测试撤销/轮换。401 检查凭据，402 检查余额，429 遵守限流；避免无限自动重试。速率限制随计划变化，更高额度需联系官方确认。[状态码与额度依据](https://docs.llmquantdata.com/en/authentication)
5. 将账号开通、数据范围、条款/书面许可、费用/限额和试查结果提交本指南第二节的内部审批；若使用场景超出公开说明，通过上述支持渠道申请明确授权。公开说明没有保证 R01 所需的异常端到端 ≤5s，须单独确认和实测。
6. 批准后再部署 adapter、配置 QuantOS 的受控审批文件与 `QUANTOS_MARKET_SOURCE_URL`，按第四节取得目标验收回执。仅在研究 agent 中连接 MCP，不会自动写入 QuantOS 的 MarketEvent/outbox。

**配置与试查示例：** 由环境管理工具把 `.env.local` 中的密钥注入 MCP/adapter，或放入 secret manager；不要把真实值写进下列命令、Git、日志或聊天。本次不执行安装或有额度消耗的查询。

```bash
# 已通过安全方式向当前进程注入 LLMQUANT_API_KEY 后，按官方 README 进行交互式试查：
npx @modelcontextprotocol/inspector npx -y @llmquant/data-mcp
```

该命令可能下载 npm 包；正式接入须在项目第三方准入中固定并审核版本。上游可选配置为 `LLMQUANT_BASE_URL`（默认 `https://api.llmquantdata.com`）与 `LLMQUANT_API_TIMEOUT_MS`（默认 15000ms，上限 120000ms），见[仓库环境变量说明](https://github.com/LLMQuant/data-mcp#environment-variables)。默认超时不满足五秒验收的证明；adapter 应结合限流、查询耗时与写入预算设计 deadline。若要通过环境保存 Remote URL，可由自己的启动器定义 `LLMQUANT_REMOTE_MCP_URL`；这是建议命名，**不是上游包已经支持的内置变量**。

**需要官方人工确认时的申请内容：** 发给 `contact@llmquant.com` 的建议主题为“QuantOS market data access / usage permission / quota / SLA inquiry”，提供组织和联系人、目标数据工具/标的/频率、预计请求量、内部研究或展示/再分发用途、存储期限，以及所需历史/实时延迟。请官方确认适用计划、额度/限流、费用、底层数据来源与许可、商业使用和再分发范围、支持/SLA，并留存回复作为审批材料。这是建议的询问模板，不代表官方承诺批准期限或已授予权限。

**QuantOS 适配边界：** data-mcp 源码的 MIT 许可证不等于底层市场数据许可。API base 和 Remote MCP URL 都不是 `RawMarketTick` JSONL endpoint，不能直接填入 `QUANTOS_MARKET_SOURCE_URL`。adapter 须保留真实时间、数据来源和稳定身份；OHLCV/24h 累计量不能冒充单笔成交量，缺 trade ID 的快照/K 线也不能随意生成逐笔事实。所选产品无法无损映射时，应先增加相应 bar/snapshot 契约并复审，而不是强塞当前 tick 契约。完成上述申请、审批和接线以前，B01 保持 NOT RUN / NO RECEIPT。

## 二、内部申请与批准文件

申请人向项目数据负责人提交工单/PR，附以下材料；许可有疑义时先取得供应商书面确认。此处角色是建议流程，具体批准人由项目指定。

1. provider/dataset 唯一名称、市场类型、标的与 alias→BASE/QUOTE 映射；实际官方 upstream URL、数据版本、时间单位与 source ID 唯一性范围。
2. 用途：内部研究、展示、存储期限、衍生结果输出、是否再分发、允许地区；合同/条款链接及留存副本、许可有效期。
3. adapter 负责人、部署 HTTPS JSONL URL、访问保护、秘密托管、限流、断线补偿与稳定游标、数据更正规则、freshness SLA。
4. 指定 tenant UUID、有效 service actor UUID；测试计划和证据目录，数据/合规审核人及批准日期。

批准后生成受控 JSON 文件，完整字段见 [ingestion Runbook](./r01_market_ingestion.md)。`approval_reference` 应指向可访问的批准工单/文档，`approval_version` 标明已批准版本，`expires_at` 使用真实到期时间，`enabled` 批准后才可为 true，`license_label` 与记录一致。文件必须包含 instrument map、非负且有效的 SLA。当前代码校验结构/过期/撤销，不会自动向工单系统验证签名或许可；部署权限须限制谁能修改批准文件。不要把 `fixture:` 引用替换成任意字符串来冒充批准。

撤销：将批准文件 enabled=false 或移除 provider，停止进程；轮询会在下一轮加载批准文件，重新启动也会拒绝已失效配置。文件模式每次启动加载，撤销需停止当前进程。审批文件可版本管理，凭据不能进入 Git。

## 三、配置变量与实际支持方式

| 配置 | 当前 ingestor 支持 | 获取人/途径 |
|---|---|---|
| `DATABASE_URL` | 已有 Supabase 配置，直接使用 | 工程现有配置；不要申请/创建本地数据库 |
| `QUANTOS_MARKET_SOURCE_URL` | `poll-source` 默认读取的 **HTTPS 标准化 JSONL adapter URL**；可用 `--endpoint-env` 指定其他变量名。禁止重定向与 URL userinfo | adapter 部署负责人提供；不能填原生 exchange REST、WebSocket、SFTP 或 MCP URL |
| 批准文件路径 | **CLI `--approvals /absolute/path/approvals.json`**；目前没有内置 approval 环境变量 | 数据负责人批准后生成，运维部署受控文件 |
| tenant/actor | **CLI `--tenant` / `--actor`**；目前没有内置对应环境变量 | Supabase 管理负责人提供现有有效 UUID |
| `QUANTOS_TRACE_EXPORT_PATH` | 必需，可写绝对路径 | 运行环境日志负责人配置；轮转/持久卷见 Runbook |
| `QUANTOS_OBSERVABILITY_ADDR` | 可选，共享健康/metrics 地址 | 运维配置授权访问的监听地址 |

可在本地 `.env.local` 保存 `QUANTOS_MARKET_SOURCE_URL` 与 trace 路径，由启动器加载；该文件不可提交。ingestor 不会自动读取 dotenv，需要 Node `--env-file` 启动器或环境管理工具将值传给子进程。审批、tenant、actor 使用参数最直接。若团队要统一环境命名，可在启动器新增 `QUANTOS_MARKET_APPROVALS_PATH`、`QUANTOS_MARKET_TENANT_ID`、`QUANTOS_MARKET_ACTOR_ID` 并转成参数；这些是**建议的新启动器变量，当前 CLI 不直接读取**。

当前 HTTP client 没有 Bearer Header/API-Key Header 配置。若供应商需要密钥，密钥保留在 adapter 的 secret manager，adapter 执行上游鉴权；若 adapter 本身要求 Header 鉴权，应先实现对应 client 能力和测试再配置。不要把密码塞入 URL；URL 查询参数也不宜承载长期密钥。当前可用受控私网 HTTPS/网络访问策略保护 adapter。

## 四、审批后完成 B01 验收

1. 先完成并审查 native provider→RawMarketTick adapter，确认 provider/source_tick_id/provider_symbol/event_time/received_at/price/volume 格式、稳定 ID、至少一次补偿及精度转换。
2. 运维提供获准 adapter URL、批准文件和有效 tenant/actor，运行 `poll-source`（**不加 `--fixture`**）；再运行 `dispatch` 使 F05 checkpoint 前进。
3. 在配置的 Supabase 读回原始身份 hash、MarketEvent、outbox/inbox/checkpoint；验证同 ID 冲突、断流与恢复、重启去重、死信修复；量测从真实异常发生到持久事件发出的 ≤5s，单列消费延迟。
4. 保存源码 SHA、批准版本、部署/网络环境、命令、计数、延迟分布及读回证据，独立复审后关闭 B01；fixture 的数据库/HTTP 测试不能替代此回执。

本次仅提供获取与申请指南，不开通账号、不购买数据、不生成虚构审批、不修改 `.env.local` 中的凭据。
