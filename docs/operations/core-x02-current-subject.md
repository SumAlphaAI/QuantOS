# CORE:X02 当前来源与公共审批 Subject

2026-10-29；DEVELOPMENT，基线 `404d8dcd13d6978f9687e2d3883f5c1d501a666b`。接续 [L4 移交](../audit/evidence/core-l4-current-local-20261028/handoff.json) 的 L4-CURRENT-SOURCE-01；原 L4 包、19项gap和8项义务保留原范围，不重写历史或授予运行准入。

公共 loopback profile 不再直接编造 Subject。owner 将 R04 不可执行 TradeProposalRecord 存入真实 repository，通过与 X03 共用的原文/manifest/身份/账户/数量/名义/信号/时效校验，解析同一订单意图；X02 对当前 X01 snapshot、日账/资金、venue健康与已批准release求值。签名决策包含完整 Proposal record hash、意图/hash、来源/hash、policy、kill generation、用途及原始期限。Subject 从这些值派生，客户端只提交 subjectId，不能上传原文、身份、风险或执行权断言。

新增用途 `assisted_testnet_review`，只接 `approval_required`；Allow/Deny/Post、preview、外来guard、签名/账户/scope/来源不符全部拒绝。公共身份保持 AssistedLive，需专有 capability；没有把身份切换成 Paper 获得 Allow。当前策略发布类型仍仅支持 Paper/Shadow；这里已批准 Shadow release 是研究前提，独立的双人审批/原生policy与固定 OWNED_TESTNET venue 控制本机受限进程。该review不是 Shadow 交易许可转为真实 Assisted Live 部署许可，也不能被现有 X03 Allow issuer 消费；实际 Assisted testnet release eligibility/M5仍未放行。

审批发起、MFA后审批、原key恢复和命令提交都查同一原始来源。锁顺序 native → approval service → current source → RiskGuard；最后一次时钟读取在风险锁内，检查和原生有界IO间不释放kill CAS锁。命令截止取原Subject/决策/审批/会话/证明及30秒命令窗口的最小值；等待锁不会用旧时间绕过截止。任何来源更新造成变化即单向撤销该Subject，保留原事实用于只读溯因；恢复旧checkpoint不能清除本进程已知撤销。kill的global/account engage及owner release均增加generation，旧决策在停止解除后仍无效，需新的研究/评估/审批。

原Proposal、决策、原期限、来源与风险generation通过原L04认证checkpoint恢复；release只在外层MAC及独立domain的owner HMAC均验证之后从owner storage重建，重新检查私有验证证明/审批完整性，不提供HTTP导入或公开Deserialize。release按hash去重存储，并缓存认证后未变化的不可变entries/releases；每次仍核验外层MAC、risk checkpoint、当前generation/时钟与撤销，不缓存这些当前权限。8d1df5bf首轮浏览器正向旅程超30秒的FAIL原件保留，新候选修复重复重建开销，未扩大浏览器超时或风险TTL。风险checkpoint独立签名，仅恢复review命名空间，不恢复Allow、issuer消费者或审批token，拒绝旧revision/时间回退。本机稳定文件锁和fsync保护仍仅为同主机机制；有权回滚整目录/密钥、跨主机与真实DB事务仍是未完成义务。旧无来源checkpoint拒绝写入迁移，不重新生成可执行权限；历史文件不改写。

公共C10的同一request_opened负载现在含Proposal原文hash、签名review决策ID、facts/snapshot hash、policy和kill generation；原审批、Command、Order继续使用同一Subject fingerprint及causation链。公开内容不含密钥、原资金明细或可执行token；Assisted Audit继续只读。来源过期/撤销不抹掉历史命令和unknown，原key不能自动补发；只有当前会话授权的事实读取继续可用。

验证仅包括本功能、共享风险/不可变Proposal校验、原生与公共mTLS/恢复的直接影响回归，以及当前P10/P11/C10和默认关闭浏览器路径。三类各50个owned风险样本是一个命名测试中的150次实际求值，和既有50双审批sample分别记账，不冒充真实venue订单数。分支覆盖95%、P95、实际身份/资金源/IdP/Vault/Supabase/RLS、真实testnet、跨主机、部署/通知/长稳/同SHA CI、完整联调及正式发布均NOT_RUN。F05/F07 campaign不执行。

工程目标 `PASS_CURRENT_R04_X02_PUBLIC_SUBJECT_BINDING`；开发实现 `IMPLEMENTED_PENDING_ACCEPTANCE`，完整Gate `NOT_READY_GAPS_OPEN`、stage `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED、M5 `PREPARED_NOT_READY`。L4-CURRENT-SOURCE-01记录本机接续进展，仍OPEN；非owned可信来源与实际目标资格仍待独立验收。

入口：`node scripts/core-x02-current-review.mjs --run <全新attempt目录>`；复核 `node scripts/core-x02-current-review.mjs --verify`。命令、原始失败、源码/输入/二进制/产物hash、评审文稿和未执行项见[本轮证据](../audit/evidence/core-x02-current-local-20261029/README.md)。历史X02_LOCAL的41节点/135组只保留旧原范围，本轮不递归重跑或改绑历史READY。

下一原任务 `CORE:X04 DEVELOPMENT`：接续当前原生Fill/Order到公共成交事实，再为X01/X05/Alert的同源账本和unknown只读对账提供来源。对应L4-LEDGER-01；不授予外部环境或发布权限。
