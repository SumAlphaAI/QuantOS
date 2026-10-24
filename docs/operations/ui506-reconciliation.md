# UI-506 对账运行与账本差异

本机功能入口 `/reconciliation`、`/reconciliation/:runId`，可带精确 `breakId=sha256:…`；只接受这些路径/查询，不允许账户、模式或任意来源注入。UUID/差异引用不能授权；当前 C15 owner 仅 Shadow。页面先双读 C01 session/context，绑定实际 account/workspace/actor/mode/capabilities 和最短到期，再订阅会话撤销、5秒复核；失权/离线/隐藏/失焦/过期/scope变化立即关闭并清除敏感事实、证据及内存恢复意图。

列表分页每页100、最多1000，所有差异/账本子页同样有界；重复ID、游标循环、跨account/mode/run/day/currency、未来时间和错误schema拒绝。筛选/搜索统计只针对已加载运行。详情读取 C15 Run、有限连续SSE、GET比对、Break/Ledger完整有界分页、再次GET一致性检查后原子展示。每3秒续传；8秒未核对或空洞/错误停止新重跑，完整重读可显式恢复。相同运行的来源hash/身份/财务结果不可被流事件改写，版本不可回退。过期来源仅可读且必须provisional；clean、无返回差异或202均不作为关闭证明。

金额采用原始Decimal字符串；Expected/Actual JSON仅验证语法，展示原始文本，保留超过JS安全整数的数值词面。无余额计算、账本写入、差异ack/close或人工改账入口。`open/acknowledged/closed`、closureReportHash、报告/input/source hash和账本版本均来自owner。

请求重跑必须理由1–256字符及确认 `RERUN RECONCILIATION`；重新读取当前C01/Run与已审阅版本一致，提交唯一允许的C15 reruns：原Run+If-Match+reason+CSRF+Idempotency-Key+RequestId。202需包含审计根，仅表示受理；按实际correlationId/auditRef扫描运行并读流，不将通用jobId猜作runId。结果未知锁定新重跑/换运行，仅手动恢复内存原body/key/version/CSRF/RequestId；无自动写重试、换键或续期。已知409/422/429不冒充成功，错误正文不展示内部SQL；离开/失权后不提供跨会话持久恢复。

证据保留 `kind/ref/sourceRef/resolution`。Order/Fill source_record原值展示；只有canonical Order UUID提供现有详情链接，不将字符串订单ID转成UUID。C14 Performance精确匹配series.reconciliationRunId和实际侧账本sourceHash、currency/account、provisional，显示ledgerVersion/valuationSnapshotId/coverage与原精度数字。C16列表限定账户，再要求同mode、reconciliation domain、sourceRef完全等于X05 exception hash；不把exception hash作为C16 UUID。C10按运行correlation有界读取完整当前授权链、校验retention/序号/去重/游标，必须包含当前auditRef；链到期不继续展示。

当前reference实际C09是Paper且来源使用不同ID，而C15为Shadow source-record，实际正向C09–C15 join仍NOT_RUN。C16 reference没有匹配的reconciliation告警，实际C15–C16正向join NOT_RUN；明确合成单元探针验证精确匹配与错配拒绝，实际读源返回未匹配不视为resolved。实际C14–C15 sourceHash及rerun–C10链消费者组合已覆盖。真实venue账本/目标存储、IdP/CORS/RLS、持久恢复/远程CI/性能长稳/完整I6/发布仍NOT_RUN。

本任务是UI506功能，P22高保真单独执行。限定工程Gate `PASS_UI506_RECONCILIATION_FUNCTION`；开发状态IMPLEMENTED_PENDING_ACCEPTANCE，正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。按`node scripts/ui506-review.mjs --run docs/audit/evidence/ui506-local-20261024/attempt-NN`冻结源码后执行；`--verify`核验源码blob/输入/精确命令/原始日志/二进制/构建/浏览器网络hash。历史证据ORIGINAL_SCOPE_ONLY不改绑。下一开发任务FE:UI-P22。
