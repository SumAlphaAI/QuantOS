# UI-P06 Strategy Catalog / Lab 高保真交付

设计依据：`design/P06-Strategy-Catalog-and-Strategy-Lab-High-Fidelity-v1.png`；任务依据执行计划 UI-P06。复用 UI-301 C01/C05 状态机，页面在 `/strategies`、`/strategies/new`、`/strategies/:strategyId/lab` 交付。

## 页面与事实映射

| 设计区块 | 当前实际交付 | 契约边界 |
| --- | --- | --- |
| 目录 / 卡片与表格 | 当前页搜索、视图切换、服务端排序/分页、真实策略名称/引用/时间 | Summary 无版本/状态/owner，不生成虚构徽章；版本从打开的 Draft 读取 |
| 文件与版本 | 服务端文件目录、当前 objectVersion、更新时间、受控代码编辑器 | 无历史版本接口，比较历史版本禁用并解释 |
| 编辑器与参数 | 文件内容、参数表单、原始 JSON、研究引用页签；键盘方向键/Home/End导航 | 参数按原类型保存，金额字符串不转浮点；文件不执行 |
| 保存与409 | 1秒有效编辑自动保存；在途编辑保留；三方diff、显式合并再保存、未知结果原键重试 | 不覆盖服务端、不静默换键；非法参数编辑暂停保存 |
| 固定输入 | 实际快照引用、实际Artifact引用数与原始引用对象 | 未返回的environment hash/许可/隔离结果明确缺失 |
| Validation | 本地JSON/32768字节校验与当前保存状态 | 静态/look-ahead检查由UI-302接入，不显示假Passed |
| 实验与Backtest Queue | 清晰空态/接入说明 | 回测/报告UI-302、Release/审批UI-303；不展示虚构进度、收益或通过率 |
| 新建 | 设计同风格受信输入/注册/打开Lab说明 | C05无浏览器创建端点，禁止伪造创建成功 |

深/浅双主题复用冻结Terminal tokens。1672px三栏、1024px两栏与验证面板换行、390px纵向重排；表格区域单独横向滚动。Header折叠/主题切换可操作，无意义的发布/历史版本控制禁用并注明原因。状态故事覆盖 default/loading/empty/error/unauthorized/stale/offline；故事不是服务验收。

## 当前功能验证

`node scripts/ui-p06-review.mjs --preflight <全新目录>` 用实际本机reference C05建立待审视觉基线，保留工作区摘要与所有失败。预检不作为冻结候选PASS。源码和基线提交后，`--run <全新attempt>` 在完整SHA执行类型/lint、55项前端测试、UI-301直接浏览器回归和P06实际交互/截图/axe；不带更新快照选项，独立重放对比视觉基线。`--verify`验证SHA、输入、原始日志和产物。截图动态ID/时间/快照引用被显式遮罩；代码、布局、状态、内容和控件不遮罩；像素差上限0.005。

Rust无修改，逐项核对UI-301原Rust输入与binary摘要后引用原构建，不重新验收上游。reference运行时fixture来源必须为实际checkout SHA；binary原构建SHA单独记录。浏览器身份cookie和loopback TLS/CORS桥接仍为替代；空目录/503/延迟为标记的合成故障，409和保存/同键重试使用实际C05。所有写入仅为reference进程内草稿。

UI-301原确认只绑定0642eaad及0eac15e4原包；新页面不将原证据改绑为新SHA。保留原8项axe incomplete及全部失败/NOT_RUN；新扫描单独记账。真实IdP/MFA/CORS、Supabase/RLS/事务/Storage、托管rewrite、Firefox/WebKit、人工读屏、native200%、跨OS、远程同SHA CI、性能/容量/长稳、完整FEP-3/G3与发布验收均NOT_RUN。当前功能门禁不等于完整P06全部故事或后续UI-302/UI-303完成。

UI-P06 `development_status=IMPLEMENTED_PENDING_ACCEPTANCE`，stage_gate保持INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED；下一原任务UI-302。
