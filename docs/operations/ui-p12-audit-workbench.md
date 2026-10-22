# UI-P12：Audit Explorer 与 Export Jobs 高保真页面

原计划 I2 UI-P12 的当前页面功能，可直接执行开发，不以 G1-DEP-01 等辅助项、原范围确认或目标环境/发布待办作为开发前置。原 G1/FEP-1 义务、阶段验收阈值不变。下一原任务为 I2 UI-204。

## 设计与数据

依据 `design/P12-Audit-Explorer-and-Export-Jobs-High-Fidelity-v1.png`，使用冻结 PRE-02 色彩、字体、焦点和共享 Terminal chrome；P12 作用域 CSS 实现筛选、结果、因果时间线、事件详情与导出抽屉。1672px为完整四栏，1440px详情下移、1024px筛选和抽屉重排、390px纵向读取。深浅主题仅内存预览，不保存身份、业务数据、筛选或签名下载URL。

复用 UI-507 runtime/gateway：实际服务端搜索/排序/游标分页、当前授权范围链、脱敏载荷、MFA/近期认证/CSRF/幂等创建和取消、显式状态查询/短时下载；新增展示只使用已授权 C10 事实。无签名验签、根哈希、审计域实时流、后台作业总数、百分比、未知健康状态或通知未读数的接口事实时不合成“已验证”结果。设计图10分钟链接说明服从既有C10更严格的最长300秒契约；202不表示生成完成，下载交接不表示附件已收到。

详情支持脱敏载荷/关联/完整性分区及左右键导航，节点路由只显示文本。复制只针对资源引用，用户手势触发；拒绝时提供手动选择，不复制下载URL。固定筛选只锁定本页输入；新搜索重置分页，不将当前页当作全量。抽屉可关闭/重新打开，焦点回到创建按钮，关闭不会取消后台作业或自动重试。小屏不展示创建/取消动作，但可查询与授权下载。访问监控复用 UI-507；失效清空整个页面和内存草稿、Abort请求，显式恢复只读取事实。

## 静态资源路由

实际入口 `/audit`、`/audit/:correlationId`、`/exports/:exportId`，保留 `/exports`、UI-507 query引用。`apps/terminal/public/terminal-route-map.json`随Next静态导出复制，`scripts/serve-static.mjs`只在有受控路由表的Terminal输出映射两个UUID资源族到audit.html/exports.html；其他请求不作通用SPA回退，website无表不受影响。`public/_redirects`提供静态托管映射示例；目标托管平台的配置与发布未执行、NOT_RUN。

本地规范路由使用 `pnpm --filter @sumalpha/terminal build` 后的 `start`/静态服务验证，裸Next dev仍可使用/audit、/exports及query入口；动态资源别名须由上述静态服务/托管重写实现。客户端独立校验UUID及重复/冲突引用，拒绝path/query覆盖，错误引用在任何C10资源请求前阻断。不能将localhost重写成功视为目标域名、CDN、Cookie/CORS或部署验收。

## 有界验证

`node scripts/ui-p12-review.mjs --run docs/audit/evidence/ui-p12-local-20261022/attempt-01`：当前开发入口，46项当前presentation/runtime/C10测试，Terminal types、局部lint、单次候选Terminal构建/秘密扫描，14项Chromium（8项P12、6项受影响UI-507页面回归），6张冻结图比较、6次axe，49项门禁/路由测试，计划检查，联调入口预期拒绝及下一UI-204开发入口。只选择受改版影响的直接路径，不重跑G1全旅程、全仓、数据库或递归前提。

复用原UI-507源码9f7552a8/原包b1ebfe7b/确认4c317ad1，按原SHA读取Git输入、原始回执/32产物及确认摘要，不把历史结果改绑当前页。Rust reference源码未改，复用其精确二进制及原source SHA/hash，不重建Rust或重跑原55项/39项完整工程门禁。仅真实调用本轮页面所需reference功能。身份cookie与CORS仍是明确测试代理替代；只读权限收窄、延迟、503为明示合成故障，不证明目标RBAC/性能。

`node scripts/ui-p12-review.mjs --verify`核对当前页候选输入、设计图、历史引用、命令/产物hash、46单测、14浏览器、6图/6次axe及159个未提升阶段Gate。原UI-507确认入口的current-input校验属于其原候选；当前页面变化使用新P12候选，不递归调用旧门禁要求旧输入不变。已有确认与全部NOT_RUN账本保持原字节。

## Gate

工程门禁 `PASS_UI_P12_CURRENT_PAGE`，人工确认PENDING，计划IMPLEMENTED_PENDING_ACCEPTANCE；INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。Firefox环境、WebKit拦截附件接收阻塞不重试、不提升。真实IdP/MFA、Cookie/CORS、目标DB/storage、持久撤权、人工读屏/原生200%、跨OS/设备、远程CI、性能/长稳、目标重写/发布仍NOT_RUN。全部历史NOT_RUN及原失败记录保留。下一原任务 UI-204 开发可继续，不将这些阶段义务变成开发前置。
