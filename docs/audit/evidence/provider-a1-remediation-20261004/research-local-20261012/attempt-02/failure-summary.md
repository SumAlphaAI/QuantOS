# 第二轮完整功能验收：FAIL，不发布 READY

冻结源码：1089bbf78b517a508c647d91a213b87c415bc67a。
135 组：133 PASS、2 FAIL。全部原件和支持产物保留；历史组件证据已逐字恢复。

- auth-rust：本地 well_formed_bearer_still_requires_remote_verification 的接收 socket 在 macOS 继承非阻塞模式；read timeout 未改变 O_NONBLOCK，立即读取发生 WouldBlock。修复只改测试服务端 I/O：显式阻塞、有界读取完整 HTTP headers，保留真实 Bearer 请求与 401 拒绝断言。
- f02-secrets：Git 历史扫描命中 PRE-04-inventory-baseline.json:6 的 openapiDigest。脱敏原报告保留；独立重算公开 OpenAPI 的 canonical JSON SHA-256 与值完全一致，是摘要误报。仅将该精确公开摘要加入已有摘要 allowlist，归档扫描另命中 A2 回执的 authBoundary 源码摘要，已与冻结 Git blob 独立比对；同时登记本次 Auth 测试修复后的公开源码摘要。只豁免三个精确公开摘要值，其他规则和 canary 负例保留，不豁免目录、字段或规则。

其余 133 组通过，包括首轮全部十项失败组、R04 100 条 Proposal/22 类伪造引用拒绝/零订单、TP05 四场景验证、A2 正向与 8+5 变异、BFF003 九个响应。不能将这些结果拼接到第三轮 READY；第三轮必须冻结新源码、从新目录完整执行。

主套件为 369 Rust PASS / 7 ignored、1390 Python PASS、229 web PASS / 3 skipped。Rust 的 5 个发布性能 benchmark、1 个目标 Supabase 用例和 1 个 PostgreSQL helper 不构成开发验收；3 个默认跳过的 UI bridge 已在 TP03/04/05 专项实际执行。本轮未使用生产凭据、未执行目标 DB、未推送或发布，性能/外部验收 NOT_RUN。
