# 工作树探索记录：不作为冻结候选验收

本目录源码为20a53f0e基线上的当时未提交工作树，不是基线commit的已验收功能；最终回执只使用新function-attempt的冻结源码、输入和执行日志。原始结果不修改、不拼入最终PASS。

- pre-fix-a3：加入最初两项组合回归后执行，跨域幂等/审计PASS，Market报价snapshot无法被Snapshot API解析，404对预期200，FAIL。
- post-fix-a3：注册合成短期snapshot后最初两例PASS。
- post-fix-a3-02：增加质量门控与负向，全部三例PASS，包含陈旧新请求拒绝/原键恢复、Failed/Degraded/空license/raw_price伪造不提升为verified。
- types-01、policy-01与plans-01：当前类型、策略/CI和隔离历史门禁负向/计划检查通过；旧门禁只执行unit fixture，不执行42节点闭包。
- gate-tests-01/02：当前scoped receiver单测的人工fixture，三原确认/源码/证据完整性核对；旧HTTP原字节仅作unit receiver测试数据，绝不作为当前执行证据。
- consumer-01：构建当前Rust BFF并由实际generated consumer验证Market→Snapshot→Research、跨域同键丢响应/并发恢复、冻结Audit分页/无敏感原文和注销统一拒绝，PASS。fixture明确synthetic，不是目标DB/worker/来源或完整UI联调。

- plans-02-failure：更新A3阶段文字时发现frontend-gate-handoff-policy仍绑定旧requiredScope，计划检查真实FAIL。修复为保留原发布移交boundary原文并追加最新scoped规则，同步machine policy；plans-03重新检查，未降低原义务。
