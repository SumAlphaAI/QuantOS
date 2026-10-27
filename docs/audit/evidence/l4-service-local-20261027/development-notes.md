# 开发诊断与历史范围

开发期间新增 Rust 测试最初使用了不存在的 issued_count API，编译拒绝后改为读取并验证真实 issuer audit，检查其中无 command_issued；Node fixture lint 最初缺少 Buffer import，补齐后严格 ESLint 通过。这两项诊断只保留在会话工具输出，未补造仓库原始日志，也不宣称曾为 PASS。

新增同 subject 拒绝测试在冻结前已通过，Node 98 项通过；最终 attempt-01 对已提交源码重新采集全部当前检查，23 项符合预期，Rust 49/49、Node 98/98。当前 frozen attempt 没有失败或中断；integration-refusal/i10-refusal 的退出 1 是预期拒绝，不是联调 PASS。

六份旧 receipt 均以固定基线原字节及各自 Git 输入、artifact/log 核对，未调用其旧 verifier（避免把当前 binary/导出目录或当前输入误绑定旧源码）。本轮检查使用新目录，不覆盖组件历史失败、原始 NOT_RUN 或证据。源码及测试范围不包含公共 UI/BFF 正向 assisted 连接，不将单独 segment 的阳性当完整统一业务闭环。
