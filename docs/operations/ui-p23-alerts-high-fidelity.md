# UI-P23 Alerts 高保真页面与响应交互

I8、FEP-6，依据前端执行计划与 `design/P23-Alerts-Inbox-and-Response-High-Fidelity-v1.png`。只在QuantOS/main本机实现与提交；不使用生产凭据，不推送/部署/发布。UI-603运行时的权限、版本、幂等、来源及离线拒绝保持，新增展示和C10/C11显式只读消费者。

## 设计适配与真实交互

| 设计区域 | 当前交付与契约边界 |
| --- | --- |
| Shell与标题 | 既有TerminalFrame/ThemeProvider、当前授权workspace/account/mode、Alerts导航、主题切换；不编造全局未读数、Fresh、Risk状态。 |
| 策略提示 | 已读不等于resolved，不触发交易/审批/运维；按钮跳到可聚焦策略说明。 |
| 左侧筛选 | 阅读状态、severity/domain、来源active、冻结分页UUID顺序；计数仅来自已加载记录，不能当全账户总数。Account只读，Venue/时间范围契约未提供故禁用。 |
| 中间告警流 | 当前读取范围、三种本地排序、按rule/UUID/correlation/sourceRef/领域搜索、选择态、语义严重程度、真实时间与版本；搜索/排序只作用已加载记录，不改变BFF分页绑定。无批量写接口，全部已读禁用并标明未提供。 |
| 右侧详情 | 当前告警来源、状态、账号和mode、阅读记录、规则、原始来源/版本折叠区。rule支持已知键友好文案，未知键原样；不填入示意阈值/影响金额/外部事件描述。根路由只读选择首条，规范详情可直达/刷新/后退重新鉴权。 |
| 阅读响应 | 显式准备→原生dialog确认→原因/MFA/确认勾选→服务端验证→复核当前对象→CAS回执；取消/Escape不触发验证/写入，清空确认内容并归还焦点。移动端和无ops.operate均禁操作。已读/未读不改变active/resolved。 |
| 订阅设置 | modal内完整领域/严重程度集合CAS保存，禁止空集合；冲突重读再确认。未知结果关闭设置后恢复原键/版本/body，不自动新建；保存后stream租约作废需重建。 |
| 处置导航 | C01 execution.operate才提供现有Portfolio路由、audit:read才提供C10规范correlation路由；ops.read才提供C11健康只读预览。无任意命令/actionId写入。C16 objectRef仅 `/operations/health`，不虚构incident/RiskDecision/订单ID；完整Operations页面留给UI-601。 |
| C10证据 | 显式读取当前correlation证据链，验证关联ID、页大小、重复eventID、单调sequence、时间与重复cursor；最多1000条/10页。complete只表示当前授权范围。新详情/ack回执/失权清空旧链；UI不采用证据返回route进行任意导航。 |
| C11健康 | 显式当前账户快照，验证account/mode、asOf、<=30秒有效期、component唯一性。过期明确标记；不能当成本告警的来源证明或处置结果。 |
| 深链与实时 | 只复制当前origin+`/alerts/<UUID>`，不包含权限/CSRF/恢复凭据；接收者独立授权。SSE保留有界手动读取/续接，EOF显示disconnected，不冒充持续连接或性能指标。 |

宽屏三栏（1672/1440），1024筛选与告警并列、详情下移，390堆叠并折叠筛选。原生dialog提供模态焦点边界、Escape与返回焦点；响应布局不引入页面横向溢出。详情长区单独滚动查看，不将viewport截图宣称完整长页验收。

## 验证与证据

冻结源码后运行 `node scripts/ui-p23-review.mjs --run docs/audit/evidence/ui-p23-local-20261024/attempt-NN`，复核 `node scripts/ui-p23-review.mjs --verify`。输入包含原设计图与源码摘要，命令/退出码/日志、fresh BFF、terminal build、浏览器网络字节摘要、截图/axe和三栏几何均绑定冻结源码。UI603当前用例适配新增显式弹窗并作为直接回归；其旧证据包不变。仅直接功能/影响验证，不递归全链/数据库campaign。

实际模块证据：本机Rust reference C01/F06/C10/C11/C16，受控X06/F09输入。cookie身份桥接和回环TLS/CORS代理明确为替代。另生成六条受控C16只读展示样本，标记 `EXPLICIT_SYNTHETIC_C16_PRESENTATION_ONLY`、providerAcceptance=false；其画面不代表提供方真实多告警或正向处置证据。浏览器失败、incomplete、NOT_RUN均保留。

工程Gate目标 `PASS_UI_P23_ALERTS_HIGH_FIDELITY`，development_status=IMPLEMENTED_PENDING_ACCEPTANCE；正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。下一原开发任务FE:UI-601。本次不自行批准ACCEPTED。

G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL保持。UI402-MARKER-SOURCE-01真实C09→C12同源正向NOT_RUN、P19-C10-EXPORT-01蜡烛导出NOT_IMPLEMENTED、C12→C14估值join NOT_CLAIMED；历史证据ORIGINAL_SCOPE_ONLY逐字节保留，不改绑为新候选。

真实IdP/cookie/CORS、目标数据库/RLS/事务、外部告警源、远程同SHA CI、Firefox/WebKit、完整I8、性能容量/长稳、人工读屏/原生200%缩放、RELEASE仍NOT_RUN。回退可按源码提交审阅git revert并重建terminal，无数据库迁移或外部状态清理；保留证据。
