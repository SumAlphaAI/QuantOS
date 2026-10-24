# UI-602 本地功能证据

状态由 `receipt.json` / `result.json` 和 `node scripts/ui602-review.mjs --verify` 确定；只有新冻结候选完整矩阵验证成功才有工程 Gate `PASS_UI602_ADMIN_GOVERNANCE`。源码提交与后续证据包提交分离，源码 SHA、输入哈希、构建/二进制哈希、命令/退出码/日志、截图均记录到独立 attempt。证据包提交不重新绑定历史验收。

## 范围

- 功能：成员/角色/策略/权限能力/签名 Engine 能力/开关 C11 CRUD；CAS、原因、MFA/近期认证、最后管理员保护、职责分离、保护资源、墓碑、审计回执与独立 C10 回链。
- 当前功能与直接影响：native governance 22 例，UI602 policy/runtime 实际 provider-consumer，原 operations consumer，共享导航；Terminal 类型/ESLint、单轮构建及客户端 secret scan，静态路由与阶段 Gate 拒绝，计划一致性。
- Chromium 六场景，零重试/跳过：角色 CRUD/取消焦点/原意图恢复/墓碑；成员/策略/开关/签名能力表单；最后管理员保护；429/409 与未知恢复；scope/无权身份/移动只读/离线；dark/light × 1440/390 的四截图及 axe。另存确认对话框截图。axe incomplete 如实保留，人工读屏和原生 200% 缩放 NOT_RUN。
- Reference 实际 Rust BFF 使用 owned synthetic C11 registry、签名 Engine 审查 fixture；identity=EXPLICIT_REFERENCE_COOKIE_BRIDGE，cors=LOOPBACK_PROXY_SUBSTITUTION。Owner 无 Audit 读权限，HTTP 组合由独立已授权会话读取 C10；浏览器不伪造 Audit 权限。429/409 是明确标注 SYNTHETIC_HTTP_REFUSAL 的代理负向探针；成功写入和原请求恢复来自真实 reference BFF。

## 历史与未执行

G4 IN_REVIEW / G4、FEP-4 NOT_READY_GAPS_OPEN / FEP-4 PARTIAL 全部保留；marker 同源、蜡烛导出、valuation join、UI601 两项 HTTP 正向与 P13-C11-SERVICE-01 仍未闭合。`historyInputs` 保存 G4/FEP4/UI603/P23/UI601/P13 原证据摘要并校验不变。历史结果 ORIGINAL_SCOPE_ONLY，无递归依赖全闭包复验。

正式 stageGate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；UI-P14 高保真 NOT_RUN。真实 IdP/Cookie/CORS、目标 Supabase/PostgreSQL/RLS/事务、外部源/venue、远程同 SHA CI、Firefox/WebKit、性能/容量/长稳、完整 I8 集成与 RELEASE 均 NOT_RUN。无生产凭据、推送、部署或发布。

`preflight-unfrozen/` 是冻结前的调试记录，包含失败，不用于候选 PASS。预检启动时一次沙箱回环端口 EPERM、早期类型/选择器/测试场景修正的情况见其说明；该目录不与后来的源码绑定为通过。

下一原开发任务：FE:UI-P14。

## 最终候选实测结果

- 当前源码候选：`dd503be39fe53c3e6f42198ef3c5e1f7d80e1082`；执行目录 `attempt-02/`，工程 Gate **PASS_UI602_ADMIN_GOVERNANCE**。证据包提交只增加封存记录，不是新的运行候选。
- `node scripts/ui602-review.mjs --run docs/audit/evidence/ui602-local-20261024/attempt-02`：全部 12 项命令达到预期退出码；INTEGRATION 拒绝为预期 exit 1，下一任务 DEVELOPMENT 为 exit 0。完整命令、时间、原始日志与哈希见 `attempt-02/executions.json`，复核 `node scripts/ui602-review.mjs --verify`。
- Vitest **41/41**；native governance **22/22**；Node Gate/路由/执行规程 **73/73**；Chromium **6/6**，零重试、跳过、flaky。类型、定向 ESLint、Terminal 单轮构建与客户端 secret scan 通过（181 个扫描文件）。
- axe 四次扫描 **0 violations**，保留 **4 条 incomplete**（每次一个 color-contrast 规则，共 16 个待人工判定节点）；不声称完整 WCAG/人工读屏通过。四张 dark/light × 1440/390 截图及一张确认弹窗截图齐备。
- 历史 G4/FEP4/UI603/P23/UI601/P13 **508 个证据文件哈希未变**。正式 Gate、目标环境、远程 CI、性能/RELEASE 状态均未提升。
- `attempt-01/` 与 `attempt-01-receipt.json`、`attempt-01-result.json` 绑定原源码 `36dd4df218fb7b696df591833c3a33ee12f0c030`，原矩阵 39/39 +22/22+6/6 仅 ORIGINAL_SCOPE_ONLY。随后补强非 JSON 401/403 清理边界并新增两例，因此以完整重跑的 attempt-02 为最终证据；不把原通过改绑到新提交。
- 变更清单见 `changed-files.json`；功能源码 23 个文件（含规程、计划、初始证据说明），后续补强修改其中 3 个文件。原预检失败仍保留。
