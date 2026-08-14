# PRE-01 产出物三：验收场景表

> 任务：PRE-01 需求拆解（FEP-0）
> 版本：1.0  日期：2026-08-14
> 依据：设计规格第 3.2、3.3、4、6.1、6.2 节；执行计划第 6、7 节
> 配套文件：[页面台账与 Story 拆解](./PRE-01-page-ledger-and-stories.md)、[路由/权限矩阵](./PRE-01-route-permission-matrix.md)

## 1. 七态全局定义

每页必须实现并可演示以下七态；场景 ID 规则 `ACC-<页面>-<S1..S7>`。所有状态具备文字、图标、语义色与读屏标签，不只用颜色传达。

| 状态 | 全局定义 | 全局验收基线 |
|---|---|---|
| S1 默认 | 正常数据加载完成后的功能态 | 字段、口径、时间、来源完整；主操作唯一且按 capability 显隐 |
| S2 加载 | 首屏/路由切换/提交中的骨架与 pending | 骨架屏而非空白；高风险点击立即 pending 防重复提交 |
| S3 空 | 无数据/无筛选结果 | "下一步 + 原因"式空态，不用模糊插画 |
| S4 错误 | 4xx/5xx/流中断 | 按 6.2 错误规范：401 清内存态跳登录、403/404 不泄露存在性、409 保留草稿不覆盖、422 字段级原因、429 显示等待、5xx 局部重试并显示 correlation ID |
| S5 无权 | 角色/capability/资源级拒绝 | 规范文案 + 返回入口；涉密钥/受限审计/高风险完全不返回内容 |
| S6 陈旧 | 数据超时效/读模型滞后/版本过期 | 醒目陈旧标识 + as_of；阻断依赖该数据的写操作 |
| S7 离线 | 断网/桌面离线 | Web 提示断开并禁写；桌面仅加密非敏感只读缓存；恢复后不自动提交旧意图 |

危险确认态（DangerConfirm）作为 S1 的子要求在高风险页单列于页面场景备注：对象摘要+影响+不可逆提示+确认短语+MFA+服务端最终校验，主按钮不默认获焦。

## 2. 全局壳（GS）验收场景

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-GS-S1 | 默认 | 顶栏显示主工作区（只读）、账户、ModeBanner、新鲜度、风险状态、搜索、Alerts；侧栏按权限显隐 Admin/Operations |
| ACC-GS-S2 | 加载 | 路由切换 P95 ≤500ms 出现骨架，P95 ≤1.5s 呈现首批有效数据 |
| ACC-GS-S3 | 空 | 新用户无待办时 Command 显示"当前没有需要你处理的事项"及下一步入口 |
| ACC-GS-S4 | 错误 | 全局 5xx 局部重试并显示 correlation ID；未知枚举显示"未知/需升级"并阻断高风险动作 |
| ACC-GS-S5 | 无权 | 越权路由返回规范无权限页；403/404 不泄露对象存在性；守卫在失败步停止后续请求 |
| ACC-GS-S6 | 陈旧 | 数据超时效时新鲜度指示转为陈旧并阻断相关交易动作；KPI 显示采样时间 |
| ACC-GS-S7 | 离线 | 底部状态栏持续显示离线/重连；Web 全部写操作禁用；桌面端仅加密只读缓存且恢复后不自动提交旧意图 |

## 3. 官网验收场景

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-WEB-S1 | 默认 | 七页内容与设计 4.1/4.2 一致；无收益承诺/跟单/喊单/排行榜文案（禁用词扫描通过） |
| ACC-WEB-S2 | 加载 | Lighthouse Performance/Accessibility/SEO/Best Practices ≥90，核心内容 LCP ≤2.5s |
| ACC-WEB-S3 | 空 | 文档中心无匹配搜索结果时给出清除条件与联系支持入口 |
| ACC-WEB-S4 | 错误 | 访问申请提交失败（含 429 防滥用）显示可重试原因，不丢失已填内容 |
| ACC-WEB-S5 | 无权 | 访问 Terminal 业务路由未登录一律重定向登录；无业务数据泄露 |
| ACC-WEB-S6 | 陈旧 | 静态内容版本化发布；文档与下载链接指向当前发布版本，无失效引用 |
| ACC-WEB-S7 | 离线 | 断网时表单不可提交并提示网络断开；已渲染内容可继续阅读 |

## 4. Terminal 页面验收场景（P01–P23）

### P01 身份、访问与恢复

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P01-S1 | 默认 | OIDC+PKCE 登录→MFA→进入安全路由；AuthCard 仅显示"安全、审计、Paper/Shadow"三事实 |
| ACC-P01-S2 | 加载 | SSO 跳转与回调交换期间显示进度，无可交互表单重提交 |
| ACC-P01-S3 | 空 | 无可用 SSO 配置/首次启动时显示访问申请与支持入口 |
| ACC-P01-S4 | 错误 | MFA 失败限流且不透露账户存在性；回调错误写认证审计，URL 无 token |
| ACC-P01-S5 | 无权 | `/unauthorized` 显示规范文案、联系管理员与复制 support correlation ID |
| ACC-P01-S6 | 陈旧 | 会话即将过期提示重认证；return path 不含敏感参数且仍指向安全路由 |
| ACC-P01-S7 | 离线 | `/offline` 显示网络断开规范文案；桌面端认证流不可用并说明原因 |

### P02 Command Center

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P02-S1 | 默认 | 卡片按 capability 裁剪；PriorityQueue/HealthSummary/KPI/ActivityFeed 均来自 BFF 投影，无静态业务数据 |
| ACC-P02-S2 | 加载 | 各卡片独立骨架，互不阻塞 |
| ACC-P02-S3 | 空 | 无待办显示"当前没有需要你处理的事项" |
| ACC-P02-S4 | 错误 | 任一卡片失败局部降级显示"此模块暂不可用"，其余模块正常 |
| ACC-P02-S5 | 无权 | 无 capability 的卡片不渲染；负向测试证明无权对象不出现在聚合结果 |
| ACC-P02-S6 | 陈旧 | 数据陈旧时 KPI 显示 sampledAt 而非最新值 |
| ACC-P02-S7 | 离线 | 显示最后同步时间；快捷创建入口禁用 |

### P03 Research 列表与新建

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P03-S1 | 默认 | 列表服务端分页/筛选/排序与 URL 同步；三步 Composer 可创建并 202 受理跳转详情 |
| ACC-P03-S2 | 加载 | 列表骨架；提交中按钮 pending 防重复（同一 Idempotency-Key） |
| ACC-P03-S3 | 空 | 无任务时引导"发起研究"；筛选无结果显示清除条件 |
| ACC-P03-S4 | 错误 | 422 校验原因字段级原位显示；超预算/无快照/过期数据阻止提交 |
| ACC-P03-S5 | 无权 | 非研/开角色无"发起研究"按钮；只读授权者不可取消他人任务 |
| ACC-P03-S6 | 陈旧 | 过期数据快照不可选并显示时效原因；Engine 不健康不可选并显示原因 |
| ACC-P03-S7 | 离线 | 列表只读（桌面为缓存）；创建/取消入口禁用并说明 |

### P04 Research 与 Artifact 详情

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P04-S1 | 默认 | RunTimeline+流式事件+EvidencePanel（快照/Engine/hash/成本/correlation ID）完整；Artifact 显示血缘与版本 |
| ACC-P04-S2 | 加载 | 运行中显示"中间输出不代表最终结论"；事件流骨架 |
| ACC-P04-S3 | 空 | 尚无事件/日志时显示排队状态与预计信息，不显示空白 |
| ACC-P04-S4 | 错误 | 失败终态保留日志与中间产物；错误提示附 correlation ID |
| ACC-P04-S5 | 无权 | 无资源授权时按 404 处理不泄露存在性；敏感日志已脱敏 |
| ACC-P04-S6 | 陈旧 | 断线重连按 last_event_id 回补；sequence 去重乱序不重放 |
| ACC-P04-S7 | 离线 | 仅显示加密缓存的终态摘要与非敏感 Artifact；取消/导出禁用 |

### P05 数据快照目录与详情

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P05-S1 | 默认 | 目录与详情展示来源/时间窗/质量/许可/schema/hash/血缘 |
| ACC-P05-S2 | 加载 | 目录与详情骨架 |
| ACC-P05-S3 | 空 | 无快照时说明来源与下一步；筛选无结果可清除 |
| ACC-P05-S4 | 错误 | 加载失败显示重试与 correlation ID |
| ACC-P05-S5 | 无权 | 未授权许可证仅显示最小元数据，内容不可见 |
| ACC-P05-S6 | 陈旧 | failed/degraded/expired/license missing 醒目标识并阻断"用于研究/回测" |
| ACC-P05-S7 | 离线 | 只读缓存可查看；复制引用可用，"用于研究"禁用 |

### P06 Strategy 目录与 Lab

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P06-S1 | 默认 | 目录卡片/表格切换；Lab 三栏可用；自动保存带版本 |
| ACC-P06-S2 | 加载 | 编辑器与 ValidationPanel 骨架；检查/回测提交 pending |
| ACC-P06-S3 | 空 | 空目录显示"尚未创建策略。你可以从研究证据开始" |
| ACC-P06-S4 | 错误 | 409 保留草稿并展示 diff，不覆盖服务端；静态检查失败列明阻断原因 |
| ACC-P06-S5 | 无权 | 非量化开发只读；编辑控件禁用并说明 |
| ACC-P06-S6 | 陈旧 | 草稿版本滞后时提示刷新；回测基于固定快照与 clock，不混用新数据 |
| ACC-P06-S7 | 离线 | Lab 禁写；桌面端草稿仅本地暂存，恢复后需重新版本校验才可保存 |

### P07 Backtest 详情与 Release

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P07-S1 | 默认 | 回测指标/权益曲线/成本/验证结果完整；Release 显示 hash/参数/快照/审批时间线 |
| ACC-P07-S2 | 加载 | 回测排队/运行状态可见；创建 Release 提交 pending |
| ACC-P07-S3 | 空 | 无回测/无 Release 时引导从 Lab 发起 |
| ACC-P07-S4 | 错误 | 验证/泄漏检查失败阻断 Release 创建并显示报告 |
| ACC-P07-S5 | 无权 | 审批目标不在 allowedTargets 内不可选；无权限角色只读 |
| ACC-P07-S6 | 陈旧 | 对象版本变化（409）退回复核；Assisted Live 在 M5 前一律不显示 |
| ACC-P07-S7 | 离线 | 只读；创建 Release/提交审批/回滚全部禁用 |

### P08 Portfolio 与 Risk

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P08-S1 | 默认 | KPI/仓位/敞口/P&L 全部含 as_of 与币种精度；风险规则命中时间线完整 |
| ACC-P08-S2 | 加载 | 图表与 DataGrid 骨架；kill switch 操作 pending 防重复 |
| ACC-P08-S3 | 空 | 无仓位/无规则命中显示"未发现阻止新命令的风险事件" |
| ACC-P08-S4 | 错误 | 加载失败保留已加载数据并显示 correlation ID |
| ACC-P08-S5 | 无权 | 非交/风角色受限只读；kill switch 仅授权风控可见可用 |
| ACC-P08-S6 | 陈旧 | 读模型滞后标记"延迟"并禁止以该数据执行命令；陈旧规范文案 |
| ACC-P08-S7 | 离线 | 只读缓存；kill switch 与一切写操作禁用 |

### P09 TradeProposal 列表与详情

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P09-S1 | 默认 | NonExecutableBanner 常驻；建议/Signal/反方观点/失效时间/证据完整 |
| ACC-P09-S2 | 加载 | 评估请求 pending；列表骨架 |
| ACC-P09-S3 | 空 | 无建议时说明来源与下一步 |
| ACC-P09-S4 | 错误 | 评估被拒绝（过期/陈旧/未发布/无权限）原位显示服务端原因 |
| ACC-P09-S5 | 无权 | 任何页面无"下单"按钮；无资源授权按 404 处理 |
| ACC-P09-S6 | 陈旧 | 数据陈旧时评估入口禁用；`executable=false` 语义永久可见 |
| ACC-P09-S7 | 离线 | 只读缓存；风险评估请求禁用 |

### P10 Approvals 与 RiskDecision

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P10-S1 | 默认 | RiskDecisionCard+规则/限额/组合影响+证据齐全；ApprovalActionBar 明确动词按钮 |
| ACC-P10-S2 | 加载 | 批准/拒绝提交 pending；MFA challenge 过程可见 |
| ACC-P10-S3 | 空 | "暂无待处理审批。新的审批请求出现后会显示在这里" |
| ACC-P10-S4 | 错误 | 自批/过期/并发冲突/额度变化被服务端拒绝并强制刷新禁用操作 |
| ACC-P10-S5 | 无权 | 非审批人不可见待办；本人发起对象不可审批 |
| ACC-P10-S6 | 陈旧 | 操作前重取 Decision 状态与有效期；过期对象禁用操作 |
| ACC-P10-S7 | 离线 | 收件箱只读；批准/拒绝/MFA 全部禁用 |

### P11 Orders 与执行详情

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P11-S1 | 默认 | 状态机时间线+Order/Fill 表+命令摘要+venue 健康+关联 Proposal/RiskDecision/Release；Paper/Shadow 横幅常驻 |
| ACC-P11-S2 | 加载 | 撤单请求 pending；事件流骨架 |
| ACC-P11-S3 | 空 | 无订单时说明模式与来源 |
| ACC-P11-S4 | 错误 | 订单拒绝/撤单失败显示服务端原因；ack 前绝不显示成交 |
| ACC-P11-S5 | 无权 | 无权限角色只读；撤单按钮仅对有权且可撤订单出现 |
| ACC-P11-S6 | 陈旧 | 断流后停在最后确认事件；回补去重不重放副作用 |
| ACC-P11-S7 | 离线 | 只读缓存；撤单请求禁用并说明 |

### P12 Audit Explorer 与导出

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P12-S1 | 默认 | 检索→EvidenceTimeline 展示主体/输入/快照/Engine/输出/规则/审批/命令/回报/对账全链 |
| ACC-P12-S2 | 加载 | 搜索与时间线骨架；导出任务状态轮询可见 |
| ACC-P12-S3 | 空 | "选择一个记录以查看可验证的证据链" |
| ACC-P12-S4 | 错误 | 检索/导出失败显示 correlation ID；过期下载 URL 拒绝 |
| ACC-P12-S5 | 无权 | 无权对象不返回存在性；导出按权限范围生成并留审计 |
| ACC-P12-S6 | 陈旧 | 事件显示 occurredAt 与保留策略；导出结果标注生成时间与版本 |
| ACC-P12-S7 | 离线 | 桌面端禁用导出；只读缓存不含敏感审计载荷 |

### P13 Operations 与 Incident

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P13-S1 | 默认 | 7 个服务健康视图+四组指标+告警列表+Incident 时间线/Runbook/操作记录 |
| ACC-P13-S2 | 加载 | 健康与指标骨架；Runbook 动作 pending |
| ACC-P13-S3 | 空 | 无 incident/无告警时显示正常状态说明 |
| ACC-P13-S4 | 错误 | 受控重试失败显示服务端原因与审计引用 |
| ACC-P13-S5 | 无权 | 非运维/管理员不可达；Runbook 动作仅显示后端批准的 actionId |
| ACC-P13-S6 | 陈旧 | 健康数据带采样时间；降级实时广播同步 Command/Orders |
| ACC-P13-S7 | 离线 | 只读；Runbook 动作与告警确认禁用 |

### P14 Admin 治理

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P14-S1 | 默认 | 成员/策略/能力/flag 四 tab 均为 DataGrid+DetailDrawer+VersionTimeline |
| ACC-P14-S2 | 加载 | 变更提交 pending；双人审批/MFA 过程可见 |
| ACC-P14-S3 | 空 | 空列表给出邀请/创建引导 |
| ACC-P14-S4 | 错误 | 版本冲突（409）提示刷新不覆盖；高风险变更被拒绝显示策略原因 |
| ACC-P14-S5 | 无权 | 非管理员不可达；删除最后管理员被阻止 |
| ACC-P14-S6 | 陈旧 | 配置显示版本与生效时间；变更前刷新对象版本 |
| ACC-P14-S7 | 离线 | 只读；全部治理写操作禁用 |

### P15 Profile、安全与通知设置

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P15-S1 | 默认 | 资料/区域/通知矩阵/MFA/会话/可信设备全部接入接口 |
| ACC-P15-S2 | 加载 | 表单保存 pending；安全操作 MFA 流程可见 |
| ACC-P15-S3 | 空 | 无会话/无设备时显示说明 |
| ACC-P15-S4 | 错误 | 保存失败字段级原因；通知权限被拒后仅显示设置说明不循环弹窗 |
| ACC-P15-S5 | 无权 | 安全变更要求近期登录；不显示他人会话与设备 |
| ACC-P15-S6 | 陈旧 | 会话/设备列表可手动刷新；撤销后实时失效 |
| ACC-P15-S7 | 离线 | 设置只读；保存/撤销/MFA 变更禁用 |

### P16 Desktop Control Center

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P16-S1 | 默认 | 通知/窗口/文件/缓存/更新卡片显示 capability 状态、最后操作与安全说明 |
| ACC-P16-S2 | 加载 | capability 探测与更新检查 pending |
| ACC-P16-S3 | 空 | 无下载/无缓存记录时显示说明 |
| ACC-P16-S4 | 错误 | 平台权限拒绝仅影响该能力并给出系统设置指引 |
| ACC-P16-S5 | 无权 | Web 访问显示受限说明与下载链接，无桌面控件 |
| ACC-P16-S6 | 陈旧 | 更新状态显示检查时间；签名验证失败不安装 |
| ACC-P16-S7 | 离线 | 本机设置可用；缓存清除需确认；不涉及服务端动作 |

### P17 Web Browser Capability

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P17-S1 | 默认 | 权限状态、下载记录、深链复制、兼容性检测完整 |
| ACC-P17-S2 | 加载 | 权限探测 pending |
| ACC-P17-S3 | 空 | 无下载记录时显示说明 |
| ACC-P17-S4 | 错误 | 浏览器 API 不可用降级为页面内通知并说明 |
| ACC-P17-S5 | 无权 | 桌面端不渲染入口；深链不含数据，接收者需重新登录鉴权 |
| ACC-P17-S6 | 陈旧 | 兼容性信息标注检测时间 |
| ACC-P17-S7 | 离线 | 页面只读；复制深链可用，授权动作禁用 |

### P18 Markets 总览与标的详情

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P18-S1 | 默认 | MarketGrid 与 VenueQuoteTable 每行含 source/venue/asOf/latency/quality；InstrumentHeader 含许可与交易状态 |
| ACC-P18-S2 | 加载 | 报价表骨架；搜索输入 ≤100ms 反馈 |
| ACC-P18-S3 | 空 | 无自选/无搜索结果给出添加与清除引导 |
| ACC-P18-S4 | 错误 | 行情源失败显示受影响 venue 与原因，不阻塞其他行 |
| ACC-P18-S5 | 无权 | 无许可证标的仅最小元数据；不可用于交易上下文 |
| ACC-P18-S6 | 陈旧 | 延迟/陈旧 venue 仍可展示但不得作为默认交易 venue；数据状态醒目 |
| ACC-P18-S7 | 离线 | 只读缓存带最后更新时间；"打开交易单"禁用 |

### P19 K 线与市场分析

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P19-S1 | 默认 | 周期仅 1m/5m/15m/1h/4h/1D/1W/自定义；series 元数据（venue/产品/interval/timezone/source/quality/as_of）完整 |
| ACC-P19-S2 | 加载 | 图表骨架；切换周期/区间 pending |
| ACC-P19-S3 | 空 | 无数据区间显示说明与可选替代 |
| ACC-P19-S4 | 错误 | 查询失败保留旧图并显示重试；缺口/质量受限提示"不应视为连续市场记录" |
| ACC-P19-S5 | 无权 | 未授权 venue/产品不可选；订单/成交标记仅当前授权账户 |
| ACC-P19-S6 | 陈旧 | 断流后固定最后确认时间；切 venue/产品清空旧 series 防拼接 |
| ACC-P19-S7 | 离线 | 只读缓存；实时增量停止并标注；打开 Trade Ticket 禁用 |

### P20 Trade Ticket 受控下单

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P20-S1 | 默认 | 表单字段由 capability 定义；VenueSelector 仅健康授权 venue（单 venue 锁定说明）；估算标注估算 |
| ACC-P20-S2 | 加载 | 每步（风险评估/审批/提交）pending 防重复；preflight 刷新可见 |
| ACC-P20-S3 | 空 | 无可用 venue 显示"无可用交易所"规范文案 |
| ACC-P20-S4 | 错误 | 价格变化/命令失效/服务端拒绝回到对应步骤并显示原因；绝不乐观显示成交 |
| ACC-P20-S5 | 无权 | 非交易员只读；进入页面不创建订单不授予权限 |
| ACC-P20-S6 | 陈旧 | 数据陈旧/对象版本变化/mode 变化即禁用提交并提示刷新 |
| ACC-P20-S7 | 离线 | 全部提交入口禁用并解释；恢复后不自动提交旧意图 |

### P21 Performance 与报表

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P21-S1 | 默认 | KPI/权益/归因/PeriodReturnTable 含 currency/method/asOf/ledgerVersion/valuationSnapshotId |
| ACC-P21-S2 | 加载 | 图表骨架；报表生成异步状态可见 |
| ACC-P21-S3 | 空 | "当前筛选范围内没有已确认的收益数据" |
| ACC-P21-S4 | 错误 | 报表生成失败可重试；下载链接过期拒绝并提示重新生成 |
| ACC-P21-S5 | 无权 | 按账户/账本/数据权限裁剪；无授权账户不可见 |
| ACC-P21-S6 | 陈旧 | 未对账/估值陈旧值醒目 provisional，不混入已确认总计；旧报表标注 superseded |
| ACC-P21-S7 | 离线 | 只读缓存；报表生成/下载禁用 |

### P22 Reconciliation 与账本

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P22-S1 | 默认 | Summary（matched/Investigating/Resolved/缺失）+BreakGrid 内外部数值/费用/原因/证据齐全 |
| ACC-P22-S2 | 加载 | 运行状态骨架；重跑请求 pending 且幂等 |
| ACC-P22-S3 | 空 | "当前范围内未发现待处理差异" |
| ACC-P22-S4 | 错误 | 重跑被拒绝显示策略原因与审计引用 |
| ACC-P22-S5 | 无权 | 无手工改账入口（负向测试证明 schema/权限不支持）；重跑仅授权运维按 Runbook |
| ACC-P22-S6 | 陈旧 | 差异实时推送 Alerts；Performance 相关数值联动 provisional |
| ACC-P22-S7 | 离线 | 只读缓存；重跑请求禁用 |

### P23 Alerts 收件箱与处置

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P23-S1 | 默认 | 筛选/AlertFeed/详情（影响、下一步、确认记录、订阅、Audit 链接）完整；仅授权事件 |
| ACC-P23-S2 | 加载 | Feed 骨架；ack 提交 pending |
| ACC-P23-S3 | 空 | 无告警时说明订阅规则与来源 |
| ACC-P23-S4 | 错误 | ack 失败可重试不重复计数；事件经 BFF 去重/限速 |
| ACC-P23-S5 | 无权 | 越权事件不出现；收件箱内无绕过风控的修复/交易动作 |
| ACC-P23-S6 | 陈旧 | 事件显示 occurredAt 与 asOf；数据新鲜度随 Feed 显示 |
| ACC-P23-S7 | 离线 | 显示最后同步时间；ack/unack 写操作禁用 |

## 5. 关键流程验收场景

| 场景 ID | 流程 | 验收标准 |
|---|---|---|
| ACC-FLOW-01 | 研究闭环 | 固定输入可追溯重放；取消确认 ≤2s；断线无事件丢失/重复；全程无订单入口；Web/Desktop 同用例全绿 |
| ACC-FLOW-02 | 策略发布 | 未验证/未审批不可部署；M3/M4 仅 Paper/Shadow；409 无静默覆盖 |
| ACC-FLOW-03 | 建议到订单 | 覆盖 allow/deny/approval_required/过期/重复/陈旧/kill switch 七种结果；重复提交 1,000 次仅一笔命令/订单事实 |
| ACC-FLOW-04 | 高风险统一流程 | 版本刷新→MFA→服务端最终校验→correlation ID 展示；UI 不乐观显示成功 |
| ACC-FLOW-05 | 审计回溯 | 抽样订单/策略/研究 ≤5 分钟还原完整证据链；每个错误可凭 correlation ID 定位 |
| ACC-FLOW-06 | 对账联动 | 注入差异后 Orders/Performance/Alerts/Audit 一致 provisional/Investigating；UI 无改账入口 |
| ACC-FLOW-07 | 离线安全 | 断网后双端全部写操作禁用；桌面仅加密非敏感只读缓存；恢复后不自动提交 |
| ACC-FLOW-08 | 认证与恢复 | 401 清内存态；403/404 不泄露存在性；MFA 失败限流；return path 无敏感参数 |
| ACC-FLOW-09 | 审批职责分离 | 自批、第二人缺失、版本冲突、额度变化、命令过期全部拒绝 |
| ACC-FLOW-10 | 小屏与桌面差异 | <768px 无审批/签发/撤单/发布入口；桌面多窗口不改变授权语义；深链重新鉴权 |

## 6. 页面 → 追踪映射（台账追踪性证明）

| 页面 | 前端任务 | 契约 | BFF 任务 | 后端计划 | 测试场景 | Gate |
|---|---|---|---|---|---|---|
| GS | UI-101/102/103、UI-VIS-000 | C01/C02/C16/C17 | BFF-FE-000/001/002/011 | F06/F09/L02/L03 | ACC-GS-*、ACC-FLOW-07/08/10 | G0/G1 |
| 官网 | WEB-101 | Access Request/Auth | BFF-FE-001 | F06 | ACC-WEB-* | G1 |
| P01 | UI-P01、UI-102 | C01 | BFF-FE-001 | F06、L03 | ACC-P01-*、ACC-FLOW-08 | G1 |
| P02 | UI-P02 | C02/C06/C16 | BFF-FE-002 | F09、R03、X01–X06 | ACC-P02-* | G1 |
| P03 | UI-P03、UI-201 | C03/C04 | BFF-FE-003 | F07/F08、R02–R04、U01 | ACC-P03-*、ACC-FLOW-01 | G2 |
| P04 | UI-P04、UI-202/203 | C03/C04/C10 | BFF-FE-003/007 | F07/F08、R02–R04、F05 | ACC-P04-*、ACC-FLOW-01 | G2 |
| P05 | UI-P05、UI-204 | C04 | BFF-FE-003 | R02/R03、F05 | ACC-P05-* | G2 |
| P06 | UI-P06、UI-301 | C05 | BFF-FE-004 | S01–S04、R02 | ACC-P06-*、ACC-FLOW-02 | G3 |
| P07 | UI-P07、UI-302/303 | C05/C08/C10 | BFF-FE-004/007 | S01–S04、F06 | ACC-P07-*、ACC-FLOW-02 | G3 |
| P08 | UI-P08、UI-501 | C06 | BFF-FE-006 | X01/X02 | ACC-P08-* | G5 |
| P09 | UI-P09、UI-502 | C07/C10 | BFF-FE-006/007 | R04、X02 | ACC-P09-*、ACC-FLOW-03 | G5 |
| P10 | UI-P10、UI-504 | C07/C08/C10 | BFF-FE-006 | F06、X03、L03 | ACC-P10-*、ACC-FLOW-09 | G5 |
| P11 | UI-P11、UI-505 | C09/C10/C15 | BFF-FE-006/009 | X03/X04、X05、L01 | ACC-P11-*、ACC-FLOW-03/06 | G5 |
| P12 | UI-P12、UI-507 | C10 | BFF-FE-007 | F05、X06 | ACC-P12-*、ACC-FLOW-05 | G5 |
| P13 | UI-P13、UI-601 | C11/C16 | BFF-FE-010 | F09、X06 | ACC-P13-* | G6 |
| P14 | UI-P14、UI-602 | C01/C11 | BFF-FE-010 | F06/F09、X06 | ACC-P14-* | G6 |
| P15 | UI-P15、UI-104 | C01/C17 | BFF-FE-001 | F06、F09 | ACC-P15-* | G1 |
| P16 | UI-P16、UI-604 | C17 | BFF-FE-011 | L02/L03 | ACC-P16-*、ACC-FLOW-10 | G6 |
| P17 | UI-P17 | C17 | BFF-FE-011 | F06、F09 | ACC-P17-* | G1 |
| P18 | UI-P18、UI-401 | C12/C16 | BFF-FE-005 | R01/R02、L01 | ACC-P18-* | G4 |
| P19 | UI-P19、UI-402 | C09/C12 | BFF-FE-005 | R01/R02 | ACC-P19-* | G4 |
| P20 | UI-P20、UI-503 | C07–C09/C12/C13 | BFF-FE-006 | X01–X03、L01 | ACC-P20-*、ACC-FLOW-03 | G5 |
| P21 | UI-P21、UI-403 | C14/C15 | BFF-FE-008 | X01/X05 | ACC-P21-*、ACC-FLOW-06 | G4 |
| P22 | UI-P22、UI-506 | C09/C10/C15 | BFF-FE-009 | X05 | ACC-P22-*、ACC-FLOW-06 | G5 |
| P23 | UI-P23、UI-603 | C10/C11/C16 | BFF-FE-010 | F09、X05/X06 | ACC-P23-* | G6 |

## 7. 覆盖统计

- 页面覆盖：31/31 = 100%（全局壳 1 + 官网 7 + Terminal 23）。
- 七态场景：每个页面 S1–S7 共 7 条，31 × 7 = 217 条，全部定义完毕。
- 关键流程场景：10 条（ACC-FLOW-01–10），覆盖执行计划 7.2 节必测 E2E 场景 1–8 与 6.1 高风险统一流程。
- 每条场景可经第 6 节映射追踪到前端任务、契约、BFF 任务、后端计划与 Gate。
