# R01 行情 provider 获取与审批配置指南

日期：2026-10-02。当前工程没有真实行情 provider URL、许可/审批记录；B01 的真实供应商验收仍为 NOT RUN。环境变量由工程运维配置，供应商提供的是数据入口、账号/授权或合同，不会向 QuantOS 颁发环境变量。

## 一、官方获取途径

| 需要 | 官方入口及申请方式 | QuantOS 接入边界 |
|---|---|---|
| Binance 公共现货行情 | [官方 Market Data Only 文档](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md)：REST base `https://data-api.binance.vision`，公共 WebSocket `wss://data-stream.binance.vision`；官方明确不需要认证/API Key。先由项目负责人确认可用地区、网络、使用条款及用途，再进行只读连通性验证 | 原生 REST/WebSocket 不是 ingestor 的 JSONL 协议；需要批准的 adapter。不要申请交易/提现权限 |
| Binance 历史行情 | [官方公共数据仓库说明](https://github.com/binance/binance-public-data)，下载入口 `https://data.binance.vision/`，按标的/日期选择数据、校验下载内容 | 转换 CSV/归档的时间单位、trade ID 与数值格式，作为历史数据使用；不能宣称实时 freshness 验收 |
| Coinbase 商业历史数据 | [官方 Data Marketplace 产品](https://help.coinbase.com/en/data-marketplace/getting-started/data-marketplace-products)包括逐笔成交与 OHLCV；通过官方 Marketplace/帮助中心的联系入口咨询购买、地区和授权范围。购买后按[官方 SFTP 下载说明](https://help.coinbase.com/en/data-marketplace/access-data/download-files)及关联的 SSH/连接教程取得账号、上传公钥、下载已购买产品 | 这是付费历史文件交付，不是低延迟实时 endpoint；合同与 SSH 私钥只进受控秘密配置 |

公共可访问不自动等于允许商用、展示或再分发。必须保存适用条款或供应商书面授权，并由项目指定的数据负责人及法务/合规审核使用范围。上表是官方渠道信息，不代表已经替项目批准了供应商，也不保证当前部署网络可达。若选其他供应商，从其官网的数据产品/开发者门户申请只读 Market Data 账号，向销售/支持确认标的、实时或延迟、历史覆盖、速率限制、储存与再分发权限、费用和 SLA。

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
| `QUANTOS_MARKET_SOURCE_URL` | `poll-source` 默认读取的 **HTTPS 标准化 JSONL adapter URL**；可用 `--endpoint-env` 指定其他变量名。禁止重定向与 URL userinfo | adapter 部署负责人提供；不能填原生 exchange REST、WebSocket 或 SFTP URL |
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
