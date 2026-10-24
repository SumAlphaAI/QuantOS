# FRONTEND-GATE:G4：FEP-4 有界组合与缺口评估

2026-10-24，原任务 FRONTEND-GATE:G4 / I7；基线5372b8cc。仅main、QuantOS；不使用生产凭据、Supabase或外部市场连接，不推送或发布。此任务不关闭FE:FEP-4里程碑，不把G4辅助项作为无关功能开发前置。

## 当前范围与修复

同一实际reference BFF实例中，以当前Shadow身份依次消费 C01/C12目录、逐venue报价/有限行情流、P18→P19规范维度路由、C14三投影/C15实际快照核查、固定版本报告/原始字节下载及C10实际审计链；不在跨页面途中换后端，不把C12报价当作C14估值来源。既有6页面/8个G4依赖仅索引原适用范围，不递归全部上游。CORE-GATE:X3-SERVICE的核心映射作为原范围参考，不重新执行完整X3、全仓、数据库campaign或发布矩阵。

本轮必要修复：

1. QuoteFeed在EOF执行fatal UTF8 decoder flush并拒绝残帧；保留最后确认报价/游标，标disconnected/error=502，不把截断输入当正常EOF。
2. 报价新/同序号不得回退asOf，事件occurredAt不得来自未来；报价及K线流在source/approval/snapshot之外也绑定license文本，变化须重新读取，不能静默拼接。
3. 可选C09端点403仅在新的C01 session/context与先前完整authority一致、期限/market.read仍有效时保留C12，清除标记并标unavailable；C01失败/变化、C09 401、C12 401/403和权限stream撤销继续清屏。此修改不扩大C09权限、不把Shadow转换Paper。既有UI402测试中“任何C09 403必清空行情”的预期同步为局部拒绝；新增已撤权/401负向不能放宽。

另将当前P19 SVG title改为单一字符串，保留精确OHLCV/缺口/标记文本，消除SSR title数组警告；不重做页面布局或改绑旧视觉结果。

所有发现先保留失败探针，再修复。首个K线许可探针因漏envelope字段出现假阳性，补齐有效envelope后6项探针全部先红；此诊断如实保留，不算最初K线验证通过。

## 当前组合矩阵

|范围|本轮证明与限制|
|---|---|
|目录→精确venue详情→K线|实际C12/R01返回；symbol/venue/product不变，有限流EOF明确disconnected；Shadow可选C09 403不撤销已重新核查的C12|
|收益/口径/provisional|实际C14/C15消费者和原生专项；当前Shadow/USD/simple/UTC。部分覆盖、来源未对账保持provisional|
|报告→固定文档→下载→Audit|实际202 queued、显式succeeded、原字节hash/size、同账户/版本、相同BFF C10 auditRef唯一；下载ticket只记hash|
|自选/报告丢响应|实际提交后仅运输丢弃；原key/body/If-Match重试、同一回执/单Audit；不是伪造BFF失败|
|C15 rerun后固定报告|实际rerun accepted；确定性同源重跑未改变账本hash，不声称新估值生成。刷新预览requested range与冻结报告不同，报告原内容不变|
|拒绝/恢复|真实Viewer拒绝、C09局部403、无效路由不派发、离线清空、显式重新读；错许可流为明确浏览器交付破坏，不是实际BFF输出|
|直接回归|P18逐venue隔离/详情路由/断流续读、P19元数据/503恢复/Viewer，以及对应策略/消费者/route monitor|

`node scripts/frontend-g4-review.mjs --run docs/audit/evidence/frontend-g4-local-20261024/attempt-NN` 冻结源码后运行；`--verify` 复核命令、源码输入、二进制/构建/网络/原始产物、旧证据与计划。旧attempt不得覆盖，失败保留原日志和未执行项。使用固定pnpm10.20.0、离线Cargo及公开环境白名单；新组合6例+直接回归6例，验证成功/拒绝/恢复。测试身份Cookie/TLS/CORS均为显式loopback替代，输入为owned synthetic reference，不是实际外部行情/成交。

## 未关闭的G4义务

- UI402-MARKER-SOURCE-01：C09 reference仍是Paper/mock执行来源，Shadow读取拒绝，不能与C12 binance/coinbase spot完成真实阳性标记join。负向不冒充阳性；合成spot消费者仅原范围。
- P19-C10-EXPORT-01：C10仅correlationIds/eventKinds scope，不能表达C12 venue/product/interval/timezone/snapshot及图像格式/用途许可；禁用是安全拒绝，导出未实现。
- C12没有与C14/C15共用的市场估值snapshot绑定，不在G4造一个市场价→账户收益的因果关系；当前报告来源仍是C15。不是新增辅助开发前置。
- 6页面用户确认与CORE-GATE:X3-SERVICE、PROVIDER:ALL阶段义务未获得新READY；历史确认/PASS不改绑。
- 真实IdP/Cookie/CORS、目标Supabase/RLS/事务/持久审计、外部市场许可/现金流/成交、跨进程持久恢复、远程同SHA CI、性能/容量/长稳、目标部署、Firefox/WebKit/跨OS、人工读屏/native200%、完整I7和RELEASE均NOT_RUN。视觉布局未修改，旧axe incomplete和视觉证据仅ORIGINAL_SCOPE_ONLY，本轮不以功能截图重验完整视觉矩阵。

工程Gate仅 `PASS_G4_OWNED_LOCAL_COMPOSITION`；正式G4=`NOT_READY_GAPS_OPEN`，review_status=IN_REVIEW、stage_gate=NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。新增修复记录不构成对旧用户确认的重签。下一原任务FE:FEP-4可开展前端范围收口与里程碑缺口评估，不能将G4 NOT_READY改写为正式完成或阻止无关UI-603功能开发。
