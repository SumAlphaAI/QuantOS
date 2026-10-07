# 执行产物与操作说明

这里保存 BFF-FE、PRE-01–PRE-06、Desktop 准备任务、P0/A1 验收规程及 R01/R02/UI 实施记录的执行产物、受控规则基线、运行说明及交付摘要。架构、规格和三份主计划留在 `docs/` 根目录；审计报告/不可变证据仍在 `docs/audit/`，确认原件仍在 `docs/gate-records/`。

首轮 25 份、第二轮 8 份原根目录文档均有独立用途，合计 33 份全部保留迁移，未删除业务内容。交付摘要中的旧日期、PASS/NOT RUN 及正式状态按当时事实保留，当前准入以主计划及有效回执为准。

| 文档 | 保留用途 |
|---|---|
| [BFF-FE-000-openapi-proposal.md](./BFF-FE-000-openapi-proposal.md) | BFF 契约边界与最终目标验收流程；A1 功能输入 |
| [BFF-FE-000-summary.md](./BFF-FE-000-summary.md) | A1 历史工程交付、staging 延期与验收范围追溯 |
| [BFF-FE-001-summary.md](./BFF-FE-001-summary.md) | 身份/设置 API 交付与风险边界；门禁读取 |
| [BFF-FE-007-runtime.md](./BFF-FE-007-runtime.md) | live Audit/export 服务配置、持久 worker 与运行说明 |
| [BFF-FE-007-summary.md](./BFF-FE-007-summary.md) | Audit 参考交付摘要；门禁检查其存在 |
| [DESK-PRE-01-requirements-transfer.md](./DESK-PRE-01-requirements-transfer.md) | Desktop 二期原生 Story/状态/流程需求承接 |
| [DESK-PRE-04-interface-transfer.md](./DESK-PRE-04-interface-transfer.md) | Desktop 二期原生接口和职责承接 |
| [PRE-01-acceptance-scenarios.md](./PRE-01-acceptance-scenarios.md) | 七态及页面/流程验收场景；自动需求门禁 |
| [PRE-01-page-api-coverage-register.md](./PRE-01-page-api-coverage-register.md) | published/planned API 到页面映射；契约覆盖门禁 |
| [PRE-01-page-ledger-and-stories.md](./PRE-01-page-ledger-and-stories.md) | 页面、Story、角色及流程需求主台账 |
| [PRE-01-requirements-baseline.json](./PRE-01-requirements-baseline.json) | 独立需求规则基线；自动门禁直接读取 |
| [PRE-01-route-permission-matrix.md](./PRE-01-route-permission-matrix.md) | 路由/角色/权限规则与需求验收 |
| [PRE-01-summary-and-risks.md](./PRE-01-summary-and-risks.md) | 历史需求交付总结、风险与确认范围追溯 |
| [PRE-02-component-inventory.md](./PRE-02-component-inventory.md) | 通用/领域组件及状态覆盖清单；设计门禁读取 |
| [PRE-02-design-system-baseline.json](./PRE-02-design-system-baseline.json) | 独立 design token/组件受控规则基线 |
| [PRE-02-summary.md](./PRE-02-summary.md) | 设计系统历史交付、边界与未完成项追溯 |
| [PRE-03-summary.md](./PRE-03-summary.md) | 工程运行时 ADR、构建和本地/目标证据边界导读 |
| [PRE-04-contract-ledger.md](./PRE-04-contract-ledger.md) | C01-C17 契约/领域依赖/owner 台账 |
| [PRE-04-field-dictionary.md](./PRE-04-field-dictionary.md) | 自动生成的 wire/计划字段与领域源映射 |
| [PRE-04-inventory-baseline.json](./PRE-04-inventory-baseline.json) | 受控 source digest、字段映射、fixture/provider 历史证据 |
| [PRE-04-openapi-gap-list.md](./PRE-04-openapi-gap-list.md) | published/planned 缺口、优先级及责任任务 |
| [PRE-04-summary.md](./PRE-04-summary.md) | 接口盘点历史产物和核查边界追溯 |
| [PRE-05-environment-guide.md](./PRE-05-environment-guide.md) | 当前 Web 环境变量、构建启动和秘密管理操作指南 |
| [PRE-05-summary.md](./PRE-05-summary.md) | 环境方案交付与目标验收范围追溯 |
| [PRE-06-summary.md](./PRE-06-summary.md) | 测试基线、视觉/浏览器回执与遗留责任导读 |

| [P0-acceptance-runbook.md](./P0-acceptance-runbook.md) | P0 阶段与正式同 SHA 验收、目标重放及 Git notes 操作规程 |
| [PROVIDER-A1-functional-acceptance.md](./PROVIDER-A1-functional-acceptance.md) | A1 内容绑定回执、功能检查与数据库执行边界操作规程 |
| [R01-summary.md](./R01-summary.md) | 行情摄取交付与 provider 许可/持续运行遗留导读；R01 检查脚本读取 |
| [R02-summary.md](./R02-summary.md) | 快照、血缘与质量 Gate 交付和本地/目标验收边界；R02 检查脚本读取 |
| [UI-101-implementation-record.md](./UI-101-implementation-record.md) | App Shell/P02 原型交付映射、守卫整改与 G1 待联调项 |
| [UI-102-implementation-record.md](./UI-102-implementation-record.md) | 认证/MFA/访问申请交付、验证与真实 IdP/G1 待联调项 |
| [UI-103-implementation-record.md](./UI-103-implementation-record.md) | 通用/领域组件交付映射、Storybook/无障碍历史证据与回调职责 |
| [UI-104-implementation-record.md](./UI-104-implementation-record.md) | 设置/浏览器能力交付、危险动作边界及 staging/P16 待联调项 |

## 历史路径定位

旧审计、内容绑定 JSON 回执与已确认文稿保留原始字节和 `docs/PRE-…`、`docs/BFF-FE-…` 路径记录，未重写其摘要或签署。阅读历史记录时，原 `docs/<文件名>` 的当前文档统一位于本目录同名文件。原始版本仍可从迁移前 Git 提交 `375019f964f375f9767b4d03a85523a141fa3f0d` 读取。

[整理报告](../audit/Execution-document-organization-2026-10-07.md)及[迁移/摘要映射](../audit/evidence/execution-docs-relocation-20261007/migration-map.json)记录逐文件决策和引用归属。迁移后的本地回归不继承旧功能 READY、G0 用户范围确认或新 HEAD hosted CI。

第二轮 8 份文档的原始版本以迁移前提交 `bf84d4e34aa85b8cc501a718442ea42a6c9af955` 为准，见[第二轮整理报告](../audit/Execution-document-organization-round2-2026-10-07.md)及[路径/摘要映射](../audit/evidence/execution-docs-relocation-round2-20261007/migration-map.json)。
