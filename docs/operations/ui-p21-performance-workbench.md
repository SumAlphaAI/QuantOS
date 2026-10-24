# UI-P21 Performance 高保真页面与报告交互

2026-10-24；原任务 I7 / FE:UI-P21，依据前端执行计划和 `design/P21-Performance-and-Reports-High-Fidelity-v1.png`。在 UI-403 已有 C01/C14/C15 runtime 上完成页面，不变更 API、财务计算或后端。主路由 `/performance`，固定报告规范地址 `/performance/reports/:reportId`。

## 页面与设计映射

|参考区域|当前交付与契约边界|
|---|---|
|共享导航、路径、标题和操作|沿用授权 Shell；保存视图、刷新已应用口径、报表任务定位、主题切换；对比期间缺少现金流调整口径，禁用并说明|
|确认条、账户/口径过滤|C14/C15 综合 provisional 原因、实际 Shadow 账户、USD/simple/UTC；周/月/季/年/custom，rolling/calendar；不伪造 Paper 模式|
|五组指标|源 P&L、simple 收益率、最大回撤和费用；已实现/未实现拆分未提供，显示 — 与原因；所有金额保留精度|
|权益曲线|净值 / 累计 P&L（权益与首点差），源时间轴、鼠标/触屏范围选择、原生滑块键盘 Home/End/方向键；精确快照数值与实际对账入口|
|周期收益、回撤|C14 没有周期现金流调整收益率，用明确标注的“相邻快照权益变化 USD，含现金流，非周期收益率”；回撤直接读取源比率，不计算恢复日期|
|归因和明细|仅源标的 P&L；账本残差明确说明；策略/Venue/周期收益维度禁用；原始序列表开关，完整账本/估值版本和对账地址|
|收益报表面板|已应用期间、账户、simple/账本/估值版本、五项固定内容；JSON 原字节格式；PDF/CSV、基准/语言/订阅未提供，不伪装成功|
|报表任务与固定报告|本会话至多25项引用；queued 仅受理，手工刷新读取；固定文档、原始状态/生成/到期/审计元数据、原字节 hash 与长度校验下载；规范地址刷新可恢复报告读取，不承诺目录或内存意图跨重启恢复|

暂定图以橙色虚线/点及文本标识；任一当前核查原因使整条预览暂定，不能用部分源点标记宣称已确认总计。超过源 maxIntervalSeconds 的间隔不连线，不补齐。图形坐标是只读投影，不参与账本计算；权益差通过 BigInt 十进制字符串计算，转换 Number 的只有有界相对坐标。回撤源值已限定在0–1，绘图使用数值缩放；所有标签仍为精确字符串。相邻权益差可能含现金流，不能称为调整后投资回报。

## 交互与权限

筛选草稿更改后须“读取收益”成功才能生成；生成仅使用 runtime 已冻结 query，刷新当前口径不暗中应用草稿。202 不下载，必须显式刷新状态并读到 succeeded 文档。任务入口展开/聚焦列表，点击当前引用走规范报告路由。重新打开报告时重算其与当前预览的版本差异提示，不能沿用另一份报告的提示。

未知创建响应锁住新建与筛选，只允许原 body/key/requestId/CSRF 恢复；429 冷却、失权/离线/上下文或有效期变化清除私有事实与意图。保持 UI-403 的完整拒绝边界、同源短时下载授权、禁止重定向、4MiB/10秒、SHA256/大小/fatal UTF8/冻结文档核对。report 过期/superseded 均拒绝下载。无新增业务写入端点、自动轮询或自动重试。

“保存视图”只向 `quantos.performance.display.v1` 保存 `{metric,showTable}` 白名单。损坏/未知类型回安全默认；不存账户、期间、金额、报告、ticket、CSRF、幂等键或权限。存储拒绝时提示并继续本次显示。所有私有报告引用仍只在 runtime 内存。

## 验证入口

- 冻结执行：`node scripts/ui-p21-review.mjs --run docs/audit/evidence/ui-p21-local-20261024/attempt-NN`（目录必须全新）。
- 只读复核：`node scripts/ui-p21-review.mjs --verify`。
- 当前单测：`pnpm exec vitest run apps/terminal/tests/ui-p21.test.tsx apps/terminal/tests/ui403.test.ts apps/terminal/tests/ui403-provider-consumer.test.ts apps/terminal/tests/performance-provider-consumer.test.ts`。
- 浏览器：`pnpm exec playwright test --config=playwright.ui-p21.config.ts --project=chromium --workers=1 --retries=0`；直接回归使用 `playwright.ui403.config.ts`。
- 类型、当前 lint、一次 Terminal build/client secret scan、静态路由/门禁/执行策略与计划校验；阶段联调入口须按原状态拒绝，不以功能 Gate 替代。

runner 显式白名单公开环境、回环 TLS identity/CORS substitute 与实际 reference binary；不带 DATABASE_URL 或服务角色密钥。常规浏览器场景使用实际 C01/C14/C15 reference 返回；dense/gap/signed attribution 场景单列 `EXPLICIT_SYNTHETIC_C14_C15_CONSUMER_ONLY`，不冒充实际 provider 阳性证据。所有失败预检保留，UI-403 原证据逐文件冻结，只能 ORIGINAL_SCOPE_ONLY。

## 范围与未执行

工程 Gate `PASS_UI_P21_CURRENT_PAGE` 仅当前本机功能/页面；development_status 为 IMPLEMENTED_PENDING_ACCEPTANCE，用户确认仍待定。159项阶段 Gate 保持 NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。I7/G4/FEP-4没有自动放行。

真实IdP/Cookie/CORS、Supabase/持久审计/事务/RLS、外部估值与真实现金流、跨实例/进程恢复、同SHA远程CI、Firefox/WebKit、人工读屏/native200%、跨OS、性能/容量/长稳、目标托管和RELEASE均NOT_RUN。axe incomplete保留人工复核义务。设计稿超出现有C14契约的项目保留可见限制，不降低发布验收标准。下一原检查点 FRONTEND-GATE:G4，先做 FEP-4 有界组合与缺口评估；不自动声称其 INTEGRATION READY。
