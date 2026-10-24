# UI-P14 本地高保真页面证据

最终状态以 `receipt.json`、`result.json` 及 `node scripts/ui-p14-review.mjs --verify` 为准。工程 Gate `PASS_UI_P14_ADMIN_HIGH_FIDELITY` 仅在新冻结候选完整直接矩阵通过后成立；源码提交与证据包提交分离，后者不是新的运行候选。

交付范围见 `docs/operations/ui-p14-admin-governance.md`。原设计图作为哈希输入，页面遵循四卡/资源表格/详情/受控变更/本会话审计记录的层级，实际数据来自 C01/C11，签名能力从真实 reference UI 提交，不复制设计图示例数据。

直接矩阵包括 P14 表现层与 UI602 当前 policy/runtime/HTTP provider-consumer/Operations/shared navigation，Terminal 类型/ESLint、单轮 build/secret scan，Node Gate/路由/执行规程，P14 五场景 Chromium 与 UI602 原六场景回归。P14 采集八次 dark/light×1672/1440/1024/390 axe/geometry/截图、五类页面截图、两张移动详情及一张确认弹窗截图。零重试/跳过/flaky 才能通过；保留 axe incomplete。

身份 `EXPLICIT_REFERENCE_COOKIE_BRIDGE`、CORS `LOOPBACK_PROXY_SUBSTITUTION`；owned synthetic C11 注册表与签名审查 fixture。成功业务写入、提交回执与原请求恢复为实际 Rust BFF。分页 setup 为明确 control 创建合成角色；429/409 为 SYNTHETIC_HTTP_REFUSAL，不能算真实网关限流/冲突服务验收。

当前页面缺口保留 P14-C11-METADATA-01/HISTORY-01/EXPORT-01/STREAM-01 OPEN：逐项签名/制品/Provider/risk/SBOM/License/CVE/能力边界报告、完整历史与审批流、成员导出、持续治理流未提供。UI 不合成 Passed/Verified/0 CVE/Live/同步时间，不提升 Engine 启用为生产批准。

G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL、marker/蜡烛导出/valuation join、UI601 两项 HTTP 正向及 P13-C11-SERVICE-01 保持。历史 UI602/G4/FEP4/UI603/P23/UI601/P13 证据哈希校验不变，只作 ORIGINAL_SCOPE_ONLY，不重新绑定旧 PASS。

正式 Gate NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。目标数据库/IdP/外部源、远程同 SHA CI、Firefox/WebKit、人工读屏/200%缩放、性能/容量/长稳、完整 I8 及 RELEASE 均 NOT_RUN。未使用生产凭据，未推送/部署/发布。下一任务 FRONTEND-GATE:G6 有界评估，未声称 READY。

`preflight-*-unfrozen/` 与 `preflight-unfrozen/` 是非冻结调试记录，不作候选通过证据。首次浏览器 0/5（可访问名称前缀冲突）保留；首次表现层 12/13 的失败是文案长度断言，已改为检查拒绝语义及不回显任意服务端信息；终端输出未保存为原始文件，此处仅为摘要。
