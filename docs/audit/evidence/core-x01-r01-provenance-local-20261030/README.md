# CORE:X01 R01认证产物到估值/风险快照的绑定

当前功能 L4-R01-VALUATION-PROVENANCE-01，main基线f494a59fdcca25063abdb2156cb6afc02f5ec240。冻结当前结果与输入/业务数据/日志见result.json；preflight全部UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE。

运行`node scripts/core-x01-r01-provenance.mjs --run --attempt=attempt-01`，只读核对`node docs/audit/evidence/core-x01-r01-provenance-local-20261030/verify.mjs`。先核对具名当前执行/计数、Git blob/hash、R01签名/F03产物、当前授权/历史head、Snapshot/风险/Subject/Command/C10/原OPEN，再写PASS。禁止覆盖失败attempt或改绑历史结果。

见[规程](../../../operations/core-x01-r01-provenance.md)、[范围](../../../execution/core-x01-r01-provenance-scope.json)、[待用户确认文稿](./review-draft.md)。owner账户/资金仍参考，真实许可live来源与目标环境、人工浏览器和原release性能ignore未验收。完整Gate NOT_READY_GAPS_OPEN，不授予正式验收或运行准入。
