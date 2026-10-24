# UI-403 Performance、归因与周期报表

I7功能交付，依据前端执行计划UI-403、C14/C15。development_status=IMPLEMENTED_PENDING_ACCEPTANCE；工程通过仅表示本机功能范围，正式INTEGRATION仍NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。UI-P21高保真及G4/FEP-4另行验收。

## 页面与支持范围

`/performance`读取收益；`/performance/reports/:reportId`读取当前授权的固定报告。规范UUID与reports后缀由静态宿主映射到performance.html，客户端再次验证；不接受URL账户、模式或任意下载授权。目标托管rewrite验收NOT_RUN。

复用共享ThemeProvider/TerminalFrame/Header/Navigation；execution.operate映射Performance导航，页面仍重读C01会话/上下文和服务端权限，不由导航授予业务权限。当前C14/C15组合仅接入Shadow及execution.operate，账户来自C01；没有模拟Paper到Shadow切换。USD/simple/UTC为当前服务支持范围。周/月/季/年可选rolling/calendar，custom要求成对ISO时间且最长366日；冻结end后用于本次summary、series、attribution及报告，避免接口各自now导致混用范围。自然周期UTC起点及滚动月末clamp与C14规则核对，不冒充TWR/MWR/年化。其他币种、策略/venue拆分、已实现/未实现拆分、语言/格式/订阅等契约未提供的维度明确说明，不补演示值。

金额、比率、费用、归因和全部版本保留原始十进制字符串；无Number格式化财务事实。前端只核对同范围、源、顺序、加法恒等式和18位输出舍入容差，不自行替代C14计算收益率或回撤。KPI和表格含币种、方法、asOf、实际/请求覆盖、账本hash、估值snapshot hash、precision与provisional。LEDGER_RESIDUAL展示为服务端残差，不虚构成策略或venue收益。

## C14/C15来源一致性与provisional

一次读取比对同一end的C14 summary/series/attribution全部投影，并在C15核对后再次读取summary；任一变化不发布混合数据。每个point读取其reconciliationRunId的C15 Run及有界分页的actual/snapshot LedgerEntry，核对账户/Shadow/currency/day/run、ledgerVersion对应sourceHash及捕获时间，并再读Run防止核查中变化。分页每页100、最多1000条/10页，拒绝重复游标/记录；序列最多1000点。该核对直接服务当前功能，不是全依赖链复验。

C14源provisional、覆盖不足、含未对账点、估值超过60秒、C15核查未完成、C15差异/provisional/过期，任一项均显示PROVISIONAL，不展示或叠加“已确认总计”。时钟tick可将现有显示降为暂定。原C14值和provisional保留；本机可读来源一致不代表目标/生产验收。C15缺失/权限/绑定失败清空本次数据，拒绝生成来源不明报告，不回退成已确认。

历史FEP5-INTEGRATION-01（C09 Paper→C15 Shadow）及-02（C15→C16）义务不因本次C14/C15本机来源接续而关闭；历史证据仅ORIGINAL_SCOPE_ONLY。

## 异步周期报表与恢复

生成必须先完成收益读取，使用已应用的冻结query而非尚未提交的筛选草稿。一次意图保留同body、幂等键、X-Request-Id及CSRF，仅向`POST /v1/performance/reports`写入。202/queued是受理；不显示已完成，也不自动轮询或重试。用户显式读取状态后，只有succeeded且固定文档匹配才允许下载。

报告固定account/currency/method/period/periodMode/asOf/coverage、ledgerVersion、valuationSnapshotId、provisional、reportVersion、createdAt/expiresAt/correlationId/auditRef。状态仅queued→succeeded；supersededBy可从null变为服务端UUID，标为历史并禁下载，不覆盖原版本。创建时服务端可能在预览后取得新来源；若冻结元数据与预览不同，明确提示按报告版本重审，不假称与预览相同。生成不允许客户端传造账本/估值版本锁。

网络丢响应、5xx或格式异常保留unknown意图，禁新建/刷新范围/换报告；显式“恢复原报告请求”重用原内容及键。恢复再次被拒绝仍不能把未知结果解锁；首次可确认4xx拒绝释放意图，429冷却不自动重试。CSRF、身份/权限/模式/环境变化或过期终止并清空；beforeunload提示未知结果。本会话只保留最多25份已生成/打开报告引用，不是服务端完整目录，不写localStorage，不声称跨刷新/重启持久恢复。

## 短时下载与不可变字节

下载先重读当前报告状态并核对所有冻结元数据，再获取C14短时grant。只接受配置BFF同源、精确reportId路径和单个UUID ticket；HTTPS默认，本机原生consumer只允许localhost/127.0.0.1的HTTP回环。禁止跳转、外部地址、userinfo/多余参数、过期/超报告寿命的grant、superseded或未完成报告；最大4MiB、10秒且受路由lifetime/权限限制。ticket不放入页面、偏好或日志，测试网络记录仅存hash。

逐块读取有界原始字节，在读取中和完成后核查ticket/report deadline和身份；核对byteLength与SHA-256，再用fatal UTF-8/生成schema校验文档及全部冻结元数据。通过后才创建短时Blob触发本机JSON下载，不重新序列化/重算金额，ObjectURL随后释放。失败不触发下载并清除文档，需显式重新读取。原报告provisional仅反映冻结时声明，不代表当前账本已确认；grant不存在跨actor/session转发许可。

## 失败、测试和边界

复核 `node scripts/ui403-review.mjs --verify`；冻结后新轮 `node scripts/ui403-review.mjs --run docs/audit/evidence/ui403-local-20261024/attempt-NN`。白名单公开环境执行新功能单元/真实reference consumer、受影响C14 provider/UI506金融policy、C14 Rust、静态路由/执行策略、typecheck/lint/build和Chromium成功/拒绝/恢复。数据库campaign、全仓、递归上游与发布性能不在本轮。

预检类型收窄/错误import/unused诊断及记录Request body未clone导致的consumer失败保留。实际服务为本机显式合成X01/C15 reference，身份cookie桥接、CORS为回环TLS代理替代；真实IdP/Cookie/CORS、Supabase事务/RLS/审计持久化、真实外部估值/现金流、跨进程恢复、同SHA远程CI、Firefox/WebKit、人工读屏/native200%、跨OS、性能容量长稳、目标托管、完整I7/G4/FEP-4与RELEASE均NOT_RUN。证据不得改绑旧版本PASS。

下一可执行原任务：FE:UI-P21，高保真Performance与报告页面。
