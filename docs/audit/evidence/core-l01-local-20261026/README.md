# CORE:L01 当前本地协议适配证据

候选采集准备中。最终证据以 receipt.json 绑定的 sourceCommit、输入摘要、逐条协议/进程矩阵及不可覆盖 attempt 为准；本文件不放行正式、runtime、真实 testnet 或发布 Gate。

- preflight-01：在 a3816e35 基础工作树添加旧边界测试，3 例失败的原始日志。未冻结完整工作树，不是当前候选验收结果。
- preflight-02：实现期间的 6 legacy + 15 protocol + 1 actual-process 测试通过日志，未冻结完整工作树，只作为开发记录。
- 当前功能与直接影响范围见 [规程](../../../operations/core-l01-current-function.md)；协议依据见 [ADR](../../../adr/20261026-l01-testnet-protocol.md)。

目标环境、签名凭据、真实 testnet 200 笔、完整业务联调、性能/长稳/同 SHA 远端 CI、正式验收和发布均 NOT_RUN。下一任务 CORE:L02。
