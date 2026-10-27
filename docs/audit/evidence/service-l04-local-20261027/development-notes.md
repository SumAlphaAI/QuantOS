# 原始诊断与历史范围

preflight-01/report.log 为旧代码下新增 3 项回归的实际 0 passed / 3 failed：目标未完成/异常计数、空数据 panic、重复四份同类演练。开发工作树未冻结完整树，不能补造 source SHA；修复后最终 attempt-02 对相同测试记录 3/3 通过。

preflight-02/replay-origin.log 为开发测试错误比较 source_event_id 造成的实际 0/4 失败。新 F05 envelope 使用新 ID，不能与 X06 checkpoint 来源标识宣称完全一致；修正为比较财务 snapshot hash/仓位，且在同一 envelope 输入上验证完整重放。原日志保留，未作为产品来源一致性的通过证明。

开发期还修复 TryLockError 转换、测试依赖/Result 歧义、重复 fixture 模块 Clippy 和 JS 注释解析问题；原输出在会话工具记录中，未补造仓库日志。曾误用 generate-lockfile 导致离线选取未缓存 uuid，随后恢复当前基线锁文件并仅更新本 crate 依赖元数据；最终 Cargo.lock 没有第三方版本升级。

attempt-01 在源码 e10fecced73e5bba0674081c8d39b3194a958337 下实际 15 项符合预期、Rust 35/35、Node 66/66。封存复核发现 recovery 查询次数误命名为 submission_attempts，之后修正为 recovery_attempts，生成新源码 4bf60cc109e337d618d8a0d73158cc2c8a3f505d 并完整采集本任务范围 attempt-02。attempt-01-original-receipt.json 保留原 SHA、原输入、日志与 artifacts；只作 ORIGINAL_SCOPE_ONLY，不用当前 binary/输入重新给旧结果发通过，也不改写原 packet。

本地证据提交不改绑候选，不触发无关依赖全闭包复验。旧 X05/X06/L01/L02/L03 历史结果保持原适用范围。integration-refusal 的退出 1 是所需拒绝，不是业务联调 PASS。
