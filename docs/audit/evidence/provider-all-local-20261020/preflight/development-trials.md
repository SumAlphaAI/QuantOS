# 冻结前开发试运行

非候选验收。首次 Rust 编译使用 std::time::Duration 而 API 要求 chrono::Duration，exit101；随后6项中3失败（惰性初始化/权限假设），4通过2失败（Paper上下文拒绝Shadow对账）。修正测试预期与初始化后6/6通过，原始可用日志保留。最初两次 gate receiver 单元试运行退出1：缺少契约读取回退、market旧probe成功时无failure字段；均已修正。另一次旧进程重复解析契约导致缓慢，优化为每次校验解析一次；仅冻结后完整记录可构成当前证据。

PRE04真实检查发现当前lib.rs源码摘要漂移，已仅刷新C01/C17/C10当前实现登记，历史验收回执不改。计划字段验证曾拒绝新增review_entry，已按原checkpoint schema移除。所有试运行失败保留，不转记PASS。

冻结前新增生成consumer2/2、Terminal typecheck/lint通过；gate receiver67/67、计划/CI86/86通过。此处为开发记录，不替代正式function-attempt。
