# 开发期诊断及历史范围

preflight-01/legacy-boundary.log 是旧 dual 行为下实际 0 passed / 3 failed 的初始回归：非有限/非正额度、未来审批和 Deny 风险未拒绝。此时测试仍在开发工作树，不给这个结果补造完整源码哈希；保留原失败。修复后最终 attempt-01/legacy-boundary.log 对冻结候选记录 3/3 PASS。

preflight-02/http-process.log 是开发期工作树实际 HTTP 3/3 通过，未冻结完整树，不能替代最终回执。开发期间的编译导入/字段错误及 Clippy bool 比较诊断已修正；其输出仅存在会话工具记录，没有补造仓库日志。最终严格编译/Clippy/HTTP 结果见 attempt-01。

唯一冻结采集 attempt-01 的 18 项全部符合预期；integration-refusal 的退出 1 是有意的当前阶段拒绝。没有覆盖/删除旧失败，没有运行全仓测试、数据库 campaign、覆盖率或递归上游 Gate。旧 X02/X03/L01/L02/前端证据保持 ORIGINAL_SCOPE_ONLY；L02 这里只回归当前 binary 直接受影响的 4 项进程测试。

证据封存校验器首次运行误将已有 sha256: 前缀再次添加，导致文稿摘要断言失败；原始输出保留在 seal-preflight-failed.log。仅修正证据校验器的前缀处理，不涉及冻结源码、机器矩阵或 18 项检查。修正后另行执行整个证据包校验；不将初次失败记作 PASS。
