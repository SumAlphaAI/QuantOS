# Desktop 二期：PRE-01 需求承接

> 日期：2026-10-02；状态：需求输入，NOT ACCEPTED；不授权二期启动或发布。
> 依据：[Desktop 二期计划](./SumAlpha-QuantOS-Desktop-Development-Execution-Plan.md)；一期 [PRE-01](./PRE-01-page-ledger-and-stories.md) 只含 Web。

## 原生 Story 与共享流程扩展

| 保留 ID / 来源 | 二期需求 | 路由 / 角色 | 对应任务 |
|---|---|---|---|
| ST-GS-08 | 多窗口、多显示器、布局恢复不改变领域状态、权限或审计语义 | 全局；全部登录角色 | UI-604 |
| ST-P01-06 | 系统浏览器认证、冷/热深链回跳后重新鉴权；URL 不含 token | /login；访客 | DESK-PRE-01、UI-604 |
| ST-P02-05 原生部分 | 高优先级待办系统通知，拒绝或不可用时应用内降级 | /command；全部登录角色 | UI-604 |
| ST-P03-06 原生部分 | 系统文件选择仅作为附件候选，先上传、扫描、生成 Artifact | /research/new；研、开 | UI-604 |
| ST-P06-06 原生部分 | 策略草稿受控本地导入/导出；不引入第二套领域状态 | /strategies/:strategyId/lab；开 | UI-604 |
| ST-GS-09、ST-P04-05、ST-FLOW-07 原生部分 | 加密非敏感只读缓存；禁创建/审批/签发/撤单/导出；恢复不自动提交旧意图，不缓存风险决定或可执行命令 | 全局及 Research/Artifact；资源级授权 | UI-604、DESK-QA-001 |
| ACC-FLOW-01、07、10 原生扩展 | 候选包复跑共享旅程；原生断网、多窗口与深链重新鉴权，绑定源提交、包 hash、OS | 对应共享路由；原权限 | DESK-QA-001 |

#### P16 Desktop Control Center

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P16-01 | 作为桌面端用户，我管理通知、窗口/显示器、布局恢复，均通过 Tauri adapter 的 capability 状态驱动 | P1 | 全部 | `/settings/desktop` | DT | 中 |
| ST-P16-02 | 作为桌面端用户，我管理受控文件访问与加密离线只读缓存；清除缓存需确认；本地文件必须先上传/扫描/生成 Artifact | P1 | 全部 | `/settings/desktop` | DT | 高 |
| ST-P16-03 | 作为桌面端用户，我检查/应用签名更新，更新验证签名后安装；可生成不含秘密的诊断包 | P1 | 全部 | `/settings/desktop` | DT | 高 |
| ST-P16-04 | 作为平台边界验证者，我确认一期 Web 不交付、不导航至该原生入口，未知路由按 404 处理 | P1 | 全部 | `/settings/desktop` | Web | 低 |

### P16 Desktop Control Center

| 场景 ID | 状态 | 验收标准 |
|---|---|---|
| ACC-P16-S1 | 默认 | 通知/窗口/文件/缓存/更新卡片显示 capability 状态、最后操作与安全说明 |
| ACC-P16-S2 | 加载 | capability 探测与更新检查 pending |
| ACC-P16-S3 | 空 | 无下载/无缓存记录时显示说明 |
| ACC-P16-S4 | 错误 | 平台权限拒绝仅影响该能力并给出系统设置指引 |
| ACC-P16-S5 | 无权 | 未授权原生能力不可调用；一期 Web 不交付该入口 |
| ACC-P16-S6 | 陈旧 | 更新状态显示检查时间；签名验证失败不安装 |
| ACC-P16-S7 | 离线 | 本机设置可用；缓存清除需确认；不涉及服务端动作 |


## 承接差异与追踪

ST-P16-01–03 保持原生含义。ST-P16-04 原先要求一期 Web 下载说明入口，现按二期计划 §4.4 改为：一期 Web 不构建、不导航至 /settings/desktop；未知 URL 按站内 404 处理。此 ID 只记录迁移决策，不是一期 Story。

P16 → UI-P16/UI-604 → C17 Desktop → BFF-DESKTOP-001 → DESK-QA-001 → D1/D2。原 P16→BFF-FE-011/G6 映射已撤销；BFF-FE-011 只承接一期 P17 Web。P17 在原生壳中无入口，其隐藏规则仅由二期共享旅程验证。

D0/D1、真实 IdP、签名更新、原生权限、OS E2E 和六方签署均保留独立验收，不沿用一期文档 PASS。
