# G8 当前 DEVELOPMENT 条件入口与恢复整改

2026-10-27，main。依据主计划、前端执行计划及最新 L4-SERVICE 回执，本轮完成现有 P10/P11 的条件声明接入与恢复边界整改。工程 Gate `PASS_G8_CURRENT_DEFAULT_OFF_AND_RECOVERY_HARDENING` 以当前冻结回执通过为准；完整 G8 `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`、review `IN_REVIEW`、formalAccepted=false、runtimeAdmission=DENIED，M5 `PREPARED_NOT_READY`。下一原项 `FE:FEP-8` 的 DEVELOPMENT 范围收口/评审准备，不能据此放行 I10 INTEGRATION。

## 服务端声明与实际页面

BFF 1.17.0 在现有 GET `/v1/order-capabilities?accountId=...&includeAssistedTestnetAdmission=true` 以显式 opt-in 增加 `AssistedTestnetAdmission`。未 opt-in 的严格旧响应形状保持不变，不把 8 秒易变声明混入 Trade Ticket 已审阅事实相等比较。生成的 TypeScript/Zod/契约/MSW/input-policy 同步；新增 optional 字段和 query 符合本仓库 minor 规则，兼容性脚本只证明工程契约，不代表发布/owner 签署。新 client 的条件读取需要 1.17.0 server；旧 server 的缺失声明只能显示不可用，不授权 Assisted Live。

声明 v1 绑定当前已核验 host AuthContext 的 actor/tenant/workspace/account/mode，含固定 schemaVersion、policyVersion、checkedAt/expiresAt（8秒），明确 `serverFlagEnabled=false`、`targetEnabled=false`、`executionAuthority=false` 与 EXECUTION_BRIDGE_UNAVAILABLE。三项 false 在生成 schema 中是 literal，不是可写开关。任意 capability label/header/public build flag/C11 自建 flag 都不能打开原生执行。Live/reference 使用同一 execution host 投影；Live 默认无获准 host 时仍不可用，没有 synthetic fallback 或数据库运行声明。

P10 高保真列表和 P11 capabilities 读取显式选择该声明；共享 `assistedAdmission` 验证 schema/策略版本、精确主体/作用域/模式和时间（未来、半开到期、倒序、>8秒及过期 C01 拒绝）。它调用已有 assistedLiveGate 的关闭规则，实际页面展示“暂未开放”或“尚未核实”，不生成 Assisted Live 链接/交易控件。声明缺失/异常/过期时不可进入，不根据公开构建 flag 推断权限。两个真实页面已接线，不再仅场景模型；原通用 helper 的 enabled 场景仍只是独立模型，不是原生授权。

这是版本化、只读、**默认拒绝**声明，不是 C11 可变 testnet flag 或真实开启条件的正向验收。G8-SERVER-FLAG-01 与 G8-P10-P11-01 的缺失读取/展示子项已整改，但完整 gap 仍 OPEN：需要真正的服务端 activation/双审批/原生执行桥及同源正向业务流程。

## 恢复和生命周期修复

初始回归实际复现 P11 五项失败：未知 submit 后 CSRF 轮换仍重放；最终来源读取期间 CSRF 轮换仍可能提交；非 JSON 401/403 后依赖外部 invalidate callback 清理意图；原 command 到期仍会恢复提交。原始日志保留，不抹成通过。

P11 submit/cancel 在最后 revalidation 前固定 CSRF；发布意图和每次 POST/原键 retry 都核对同值，HTTP 只发送原 CSRF/key/body。CSRF 变化在提交前使 runtime 失效并清除私有事实/恢复意图，不要求外部 callback 再调用 close。submit 恢复有效期取原 command、approval、C01 最早期限，半开到期不重放且保持未知状态；canRecover/实际按钮均禁用，不能把未知标成失败或成功。cancel 的契约未给 command expiry，保持风险降低语义，只绑定当前 C01/CSRF/权限并由后端校验真实 cancelRef，不编造 deadline。低保真显式模型覆盖 unchanged/revoked/expired/current authority/原键/撤单，真实 Paper HTTP 与浏览器另做直接成功和恢复回归。

P10/P11 在 transport 获得授权拒绝状态时就执行自己的 lifetime abort/私有状态清理，再处理原字节；避免非 JSON 401/403 绕过回调。config.authorize 失效也终止。SDK 的网络包装由已记录的拒绝状态归一，保留原响应来源标签，不补造 provider JSON。C10 证据和 C15 关联读取的资源级 403 保持独立，不撤销原本有效的 C01；单次 MFA 失败也不自动等同全会话撤权。瞬时 503/离线保留未知请求与只读边界，无自动重试/换键。关闭或失权后的迟到响应不得重建私有数据。

## 当前验证范围

当前 BFF execution 宿主 29 项（含新声明、默认严格形状、作用域及无下游 IO）、代码生成/兼容性/OpenAPI、直接单元/consumer 与 API client 契约、Terminal typecheck、定向 ESLint/Clippy/fmt、当前 Terminal 构建，以及 Chromium 当前条件/失权与原 G8/FEP5 Paper 成功/拒绝/恢复共 9 项。新增 browser 读取实际 C01/C09、两个页面的关闭提示、390px 布局和非 JSON 403 清理；实际 Paper P10→P11→C10 验证审批、Command、撤单丢失响应同键恢复。网络只在 loopback，外部地址由 harness 阻断。

浏览器使用真实 reference BFF 字节和显式 cookie 身份/TLS/CORS 代理，Paper mock Order 的 fills=[]，不冒充 native L01 Fill、真实 IdP/MFA 或目标 Cookie/CORS。新的 403 拒绝为显式 transport 探针，不能称真实 IdP 撤权。自动 axe violations 与 incomplete 分别记录；截图实查不替代读屏/原生缩放。实际 testnet 未连接。

原 G8/FEP-8 与最新 L4-SERVICE 回执只核对原字节/Git 输入/artifact 的完整性，保持原 SHA/ORIGINAL_SCOPE_ONLY；不调用旧 verifier、当前 binary 或旧导出目录来重新给旧候选通过。L4 已有 keyed L03 审批与原生同 subject 拒绝，原 G8 legacy prefix/hash 仅保留原 fixture 范围；它们仍未进入当前公共 BFF/双审批 C10/持久恢复链。本轮不递归重跑 native L01/L02/L03/L04 Gate、数据库 campaign、覆盖率、全仓或完整浏览器矩阵。

## 执行与移交

先提交候选，再运行 `node scripts/frontend-g8-current-review.mjs --run docs/audit/evidence/frontend-g8-current-20261027/attempt-NN`；白名单环境、固定 pnpm、Cargo locked/offline，禁止读取 dotenv/生产凭据，attempt 不覆盖。`--verify` 只读核对固定回执/输入/binary/build 与 current matrix。20261024 的原 G8 verifier 保留原冻结范围，不能承担本次新增跨 C09/P10/P11 范围。

首个冻结候选 `2eb1eea8` 的 attempt-01 停在兼容性检查：原比较器把已有 parameters 数组的可选增量也判为破坏。保留失败原件；整改仅接受原参数逐字不变、身份无重复且新增 inline query/header/cookie 非必填参数，其他变化仍走原数组对比及原回执，新增 11 项专项测试并保留 A1 21 项回归。重新冻结后使用新 attempt，不覆盖首轮记录。

19 项原始业务 gap 的 ID 和 OPEN 均保留，进展单列：[当前机器评估](../execution/frontend-g8-current-assessment.json)。共同事实/审计、真实 Research/Release→Proposal、C15/C16 等 15 项继承缺口，C11 activation、P10/P11 双审批正向、C09→L01 同源、F06/双审批→C10/持久恢复四项未闭合。新的安全缺陷修复不等于完整 gap 自动关闭。

目标 NOT_RUN：真实 IdP/MFA/Cookie/CORS、Vault/数据库迁移/RLS/角色/事务/Storage、业务持久审计与跨进程多副本恢复、实际 venue HTTP/signing/testnet、OS/目标网络/秘密轮换、部署/通知/容量/全面安全/长稳/同 SHA CI、全浏览器/人工读屏/原生200%缩放以及 RELEASE。没有生产凭据、真实外部下单、push、部署或发布。`FRONTEND-GATE:G8` 与 `FE:FEP-8` INTEGRATION 均保持 STAGE_NOT_READY；正式确认另行 PENDING，不自签。

[证据包](../audit/evidence/frontend-g8-current-20261027/README.md)。
