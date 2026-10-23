# UI-P08 Portfolio 与 Risk 高保真页面

参考 `design/P08-Portfolio-and-Risk-High-Fidelity-v1.png` 的主工作区/右侧风险栏、六指标卡、权益、仓位、敞口、规则与详情层次。实际交付 `/portfolio`、`/risk`、`/risk/rules/:ruleId`；严格 UUID 静态映射与客户端解析，规则引用只能绑定当前授权账户的 `limitIds ↔ hitRules`，未知/已不在当前命中列表的引用不可用，不推断已解除。不虚构规则定义查询 API。

## 功能与数据口径

复用 UI-501 C01/C06/C16 生成客户端和当前风险运行时。账户、模式、身份、期限、密集 journal、同帧组合/风险、CSRF、step-up、原意图幂等恢复保持既有边界。新增流错误响应关联 ID 的安全解析，加载失败保留获授权的当前内存事实并禁写；离线/撤权/隐藏/焦点变化仍清除敏感事实与认证引用，仅显示最后同步时间，恢复显式重新鉴权。

KPI/仓位保持 MoneyValue 与 DecimalValue 原始精度、asOf、币种（来源明确时），不做 JS 浮点估值。六卡中的净资产、分项 P&L、净敞口没有来源，显示“— / 来源未提供”。汇总 P&L 不改名为今日 P&L，总敞口不推断币种。Mark/MarketValue/逐仓 P&L、资产/策略/venue 分布、集中度/杠杆阈值和趋势未提供；保留设计位置，以不可用状态替代示例图表，不补造曲线、热图比例或预算值。规则只有命中事实，普通命中不推断 Warning/Blocking 严重性，只有明确 GlobalKill/AccountKill 表示 Kill 阻断。

权益区有加载骨架、来源缺失状态；仓位支持实际 symbol/side 搜索与排序、密度、只读详情、筛选空态。保存视图只保存 search/side/sort/compact 四项，拒绝恢复持久领域数据、账户和 MFA 引用。下载受控报告、关联订单/证据缺失时禁用，不生成不受控导出或跨任务交易动作。

右侧 Risk Overview、预算不可用面板、当前命中列表与引用详情、当前访问实际读到的风险观察、独立 C16 风险告警。观察记录最多20条，按真实快照变化去重，asOf 标为来源快照时间；它不是完整历史命中日志，不伪造 occurredAt。C16 告警沿用当前账户/模式/域校验、首100条与 nextCursor 提示，不充当风险写授权。

## 危险确认

使用共用 `DangerConfirmDialog`，默认焦点为取消、焦点约束、Escape/取消、完整短语与六位 MFA、pending 防重复；原因/动作在弹窗外，弹窗打开后由 modal inert 防止修改。真实 C01 MFA/reauth 引用由服务器签发并消费，客户端不制造服务端签名。陈旧/未知/断流禁止风险写和认证交换；对话框打开期间状态变化时仍由运行时逐步重验。未知结果关闭认证弹窗、清除码并锁定原意图；先显式重读，再显式重试原 body/key/proof，不新发另一意图。Owner/Operator 权限由 BFF 决定；C01 当前未返回角色/细分风险写 capability，UI 不按 actorId 猜测角色或授予写权限。

## 场景对应与偏差

- ST-P08-01 / ACC-P08-S1：参考结构、来源精度/时间、仓位和已发布事实；估值、历史图、预算、完整时间线缺失项明确不可用，不能记为真实源验收通过。
- ST-P08-02 / ACC-P08-S6：60s 来源快照/8s 核验期限及明确 stale、断流禁写，状态常驻。
- ST-P08-03：规则详情路由和抽屉式右栏为当前命中引用；完整规则定义/阈值/历史未发布，保持来源缺口。
- ST-P08-04 / ACC-P08-S2/S5：DangerConfirm+MFA、实际参考 Operator 启用/Owner 解除/Operator 解除403、外部账户 Kill 更新广播；无 execution.operate 直接拒绝，不放宽 BFF 读权限以假装受限只读。
- ST-P08-05：视图保存；只有实际返回审计关联引用时提供审计链接，无 Order/Proposal 引用及报告能力则禁用。
- ACC-P08-S3/S4/S7：加载/空/失败关联 ID、数据保留与禁写；断网显示最后同步并按高敏页面策略清除业务事实，恢复不重发。

主区 Kill banner 与固定底栏同时显示聚合状态；底栏在移动规则详情滚动位置仍常驻。响应：1672px 左右双栏，1024px 风险区下移双列，390px 单列与表内横向滚动；规则详情导航聚焦标题并移动到可读位置。明暗主题、键盘/弹窗和 axe/截图只证明本机范围；人工读屏、native200%、跨 OS/多浏览器、真实长期 SSE/持久目标、远程同 SHA CI/完整I4/RELEASE 仍 NOT_RUN。

执行和复核：`node scripts/ui-p08-review.mjs --run <新 attempt>` / `--verify`。冻结源码/设计稿/输入/二进制/命令/日志/构建产物/网络/截图哈希，保留失败，不改绑 UI501 历史结果。状态 `IMPLEMENTED_PENDING_ACCEPTANCE`、INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。下一原任务 FE:UI-502。
