# 开发过程记录（不作为冻结候选 PASS）

- preflight-01 基于 3868be3f 加未提交测试：6 项新增实际 reference consumer 测试中 5 fail/1 pass，分别揭示非 JSON 401/403、作用域/本地监视器失效后残留及 CSRF 轮换后重放；503 原意图恢复是通过的控制项。
- 中间一次替换误将 authorize helper 改为递归调用，工具原输出为 9 fail/1 pass；冻结前已更正，没有覆盖或声称通过。该次原输出保存在会话工具记录，没有伪造磁盘原始日志。
- preflight-02 为递归修正后的原始日志：8 pass/2 fail，清除行为已正确但 SDK 的 BffTransportError 包装丢失 401/403 状态；随后以本地已捕获拒绝状态规范当前操作错误，未改写 provider JSON。
- preflight-03：10/10 consumer 及 6/6 原生 C15 组合通过，输入仍为开发增量，不冒充源码冻结验收。
- 系统 Python 缺少 tomllib，另有一次编辑 heredoc 的编码解析失败；不作为测试通过结果。正式记录器固定工程 engines/.venv/bin/python，未安装/修改系统 Python、服务或数据库。
- attempt-01：b2941988 的 Rust/Python/consumer/类型/JS lint 通过；严格 Clippy 默认递归检查被未修改 engine-manager 的 Display/to_string 风格告警阻断。当前包 --no-deps 严格 Clippy 定向通过；仅缩小风格检查到本项包，不跳过依赖编译或当前行为测试。
- attempt-02：9c0d8280 的当前包 Clippy、构建和新增 X3 两条浏览器链通过；UI506 8 pass/2 fail。状态从 open 本地化为待调查，背景由 main 移到共享壳并使用现行 design tokens。没有产品缺陷被忽略：更新 UI 断言并核对原始服务端 open 状态，主题在实际 p22-frame 上匹配现行设计 token，断言未放宽为任意非透明色。
- preflight-04 只运行上述两条修正场景：2 pass；产品输入未改变，复用 attempt-02 静态导出，仍按原来源记录，未作为最终源码通过。最终 attempt 独立保存完整同范围结果。
