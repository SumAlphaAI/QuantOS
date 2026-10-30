# CORE:X01 独立账户来源 DEVELOPMENT 验收文稿（待确认）

```json
{"schema":"quantos-acceptance-draft/v1","draftedBy":"Codex","mode":"AGENT_DRAFT_USER_CONFIRMATION","request":{"nodeId":"CORE:X01","stage":"DEVELOPMENT","inputsDigest":null,"reviewDimensions":["Product","Frontend","BFF","QA","Security","Risk","Domain"]},"reviewDimensions":["Product","Frontend","BFF","QA","Security","Risk","Domain"]}
```

范围为 L4-ACCOUNT-STATE-PROVENANCE-01 当前owned来源适配；sourceCommit、输入与具名实际执行以result.json为准。inputsDigest/approval未授予、selfApproved=false，本稿不是用户确认回执，不授予完整Gate或运行权限。

Product/Domain：独立批准的Opening/basis和状态Observation产物绑定scope/用途/provider/批准文档/版本/hash、精确原Opening与当前raw输入；不从mark/Fill/修正books推断资金，不重基准期初现金/PnL或预算。owner批准的签名产物有别于原裸参考输入，但不等于真实venue资金/许可或账户全集。

BFF/Security：账户独立Policy来自owner MAC私有端口；专用域签名/证书有效期、公钥与R01/observer分离，换证同钥仍拒绝。当前头连续追加，撤销/不健康/停用/过期/回退/client自带证明/缓存替代拒绝。共同fence覆盖IO前最新来源及native预留/fsync/IO；冷恢复篡改不自动修复。单机MAC/pin不证明实际IdP/Vault/RLS/外部单调锚或跨主机恢复。

Frontend：API1.33.0/160operations/180schemas和同源生成，公开Summary进入估值/风险/Subject/Command，Terminal核对双来源/原期限，显示独立账户来源与非venue资金边界。自动消费者/类型检查不替代当前浏览器与人工无障碍。

QA/Risk：当前功能、序列化和直接相关恢复回归具名运行，旧L4/X01证据原SHA/原范围、原FAIL/ignored/NOT_RUN均保留，不以空执行/漏执行/历史改绑放行。新风险仍绑定不可变Proposal、原独立审查/双MFA/C11/kill条件；实际UNKNOWN保留两个原证明、generation0、签名/claims、1已知入账/1隔离/7 OPEN，无新估值、不补发/自动关闭或放宽限额。

功能IMPLEMENTED_PENDING_ACCEPTANCE，工程Gate以冻结执行为准；完整Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY。19gaps/8义务OPEN、159阶段及200venue/50旅程/4目标演练分母不变，fullBooksReady/dayCloseAllowed/executionAuthority=false。

真实资金/状态/live来源/Research/R04/账户全集/IdP/MFA/Supabase/Vault/RLS/跨主机/外部锚、轮换/多账户源、FX/非报价币费用/外部流/负债/在途预算/日切、通知/源关闭、安全容量长稳同SHA CI/发布及浏览器人工无障碍均未验收或NOT_RUN。仅owned证书/fixture/loopback，无生产凭据或外部发布。下一CORE-GATE:L4 DEVELOPMENT评估双来源加入后的当前组合与剩余缺口。
