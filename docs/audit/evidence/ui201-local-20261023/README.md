# UI-201 本机功能证据索引

唯一权威通过结果为最终 `receipt.json` 指向的冻结候选与 attempt；其他目录均是保留历史，不得从失败轮次拼装通过回执。

- `preflight-01`：首次错误导入路径的实际工具输出摘录（明确为 observed transcript）；随后类型检查暴露测试 handler 的返回类型，单测暴露冷却延期与刷新旧游标检查问题。原始失败日志保留。修正了导入、返回类型、冷却期限及新查询游标隔离。
- `preflight-02`：121 项单测、类型与初始构建通过；浏览器启动因 sandbox loopback EPERM 拒绝，未执行测试。后续用获准本机端口执行，不把此失败算 PASS。
- `preflight-03`：浏览器 8 项失败，包含不稳定标签/Next route-announcer 定位冲突；末项又受到预检仍运行时启动重建的干扰，出现 404。门禁首次因报告链接尚未落盘失败，落盘后再验，不改写旧日志。该轮全部不可作为冻结候选通过证据。
- `preflight-04`：122 项单测、构建、类型/lint 与修正后门禁测试；新增静态 host 回归后为 52 项。Rust 格式检查首次失败后修正，仅影响新测试格式。
- `preflight-05`：3 项浏览器通过、5 项失败；定位到静态 host 在 research 目录存在时未解析 research.html，以及后端字段错误焦点早于控件启用。失败 hook 等待超时，部分场景没有 ui201.json，此缺失保留，不能补造。故障收集改为有界等待并先保存证据再清理。
- `preflight-06`：新静态 host 测试 lint 失败（Node 显式 globals 导入），未继续构建。`preflight-07` 修正后 lint/build 通过。
- `preflight-08`：7 项业务浏览器通过，末项 axe 检出小屏空表滚动区未能键盘聚焦，修复为具名可聚焦区域；不把旧 serious violation 改写。
- `attempt-01`：冻结工程 7330aa2d17b86752e8a536fef6190d93a3b43af0；24 Rust、122 单测、类型/lint/build 通过，浏览器 7/8，末项发现小屏创建表单被长选项撑宽。保存 inputs、执行、截图、axe 与失败日志。后续以 e3776999 修复表单宽度并补齐空表数据单元；本轮不合格记录不删除。
- `preflight-09`：宽度约束的中间构建，非最终 frozen candidate 验收。

预检发生于未提交工作区：部分工具 `sourceCommit`/buildId 是调用时环境中的基线 d167790c；只用于诊断，并不表示该基线包含新实现或已通过。最终工程输入和产物须由 `receipt.json` 的 inputs/sourceCommit 验证。旧失败截屏/错误上下文按原字节保留。

UI-204/UI-P05 的原工程/确认、原 axe 两份报告与历史 NOT_RUN ledger 仅以原 SHA/hash 复用；本轮没有重跑上游全链。原 P05 六项图标对比度 incomplete 保留，不能用本页 axe 结果覆盖。真实身份/CORS、Firefox/WebKit 阻塞与目标环境等未执行范围见 scope 与最终报告。
