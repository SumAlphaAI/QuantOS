# 第二轮执行文档目录整理复核（2026-10-07）

迁移前源码：`bf84d4e34aa85b8cc501a718442ea42a6c9af955`。范围为用户指定的 8 份根目录 Markdown 文件。8 份全部保留迁入 `docs/execution/`，删除 0 份；两轮共整理 33 份执行产物。

## 逐份判断

| 文档 | 保留理由 |
|---|---|
| [P0-acceptance-runbook.md](../execution/P0-acceptance-runbook.md) | P0 阶段与正式同 SHA 验收、目标重放及 Git notes 操作规程 |
| [PROVIDER-A1-functional-acceptance.md](../execution/PROVIDER-A1-functional-acceptance.md) | A1 内容绑定回执、功能检查与数据库执行边界操作规程 |
| [R01-summary.md](../execution/R01-summary.md) | 行情摄取交付与 provider 许可/持续运行遗留导读；R01 检查脚本读取 |
| [R02-summary.md](../execution/R02-summary.md) | 快照、血缘与质量 Gate 交付和本地/目标验收边界；R02 检查脚本读取 |
| [UI-101-implementation-record.md](../execution/UI-101-implementation-record.md) | App Shell/P02 原型交付映射、守卫整改与 G1 待联调项 |
| [UI-102-implementation-record.md](../execution/UI-102-implementation-record.md) | 认证/MFA/访问申请交付、验证与真实 IdP/G1 待联调项 |
| [UI-103-implementation-record.md](../execution/UI-103-implementation-record.md) | 通用/领域组件交付映射、Storybook/无障碍历史证据与回调职责 |
| [UI-104-implementation-record.md](../execution/UI-104-implementation-record.md) | 设置/浏览器能力交付、危险动作边界及 staging/P16 待联调项 |

四份 UI 记录虽未被当前脚本或其他文档引用，仍保存独立的需求/实现/验证映射、整改经过和未完成边界，没有证据表明内容已完全被替代；不能仅因入链数量为零删除。R01/R02 的摘要存在性是现有静态检查的必需输入；P0/A1 规程被现行前端计划直接引用。

## 修改与保留边界

同步前端计划的两处规程链接、R01/R02 检查脚本的读取路径及 execution 目录索引。迁移文件只调整相对链接，业务正文、日期、历史 PASS/NOT RUN、供应商许可与目标验收边界不改变。历史报告与内容绑定回执、用户确认原件不重写；旧根路径由[目录索引](../execution/README.md)和[迁移映射](./evidence/execution-docs-relocation-round2-20261007/migration-map.json)定位当前同名文件，原文可从迁移前提交读取。

## 当前准入

本轮开始时 159 个阶段节点均为 NOT_ASSESSED、READY 0；当前 G0 确认为 PENDING。本轮保持全部阶段字段、开发状态和正式验收记录，不恢复旧 READY，不生成替代功能回执或用户批准。本地静态检查不构成新 Supabase、真实 provider、浏览器、hosted CI 或 RELEASE 验收。

## 验证

- [逐文件核验](./evidence/execution-docs-relocation-round2-20261007/relocation-verification.json)通过：8 份文档全部到位，非链接业务正文一致、链接已重定位且目标存在；四份 UI 原文未变。此前迁移的 25 份文档及 7988 份历史审计/确认记录未改字节。
- R01/R02 静态检查、脚本语法检查、G0 记录检查通过；60 项 R01/R02/计划顺序回归通过。未执行 Rust 运行时、数据库或真实供应商检查。
- 计划联合结构与排期 PASS；47 个核心任务、75 个前端任务、159 个节点、37 个检查点及 1462 条依赖保持；159 NOT_ASSESSED、READY 0。开发状态、workflow、全部阶段字段、正式检查点字段与迁移前一致。
- 秘密扫描及 diff whitespace 的结果见[提交前核验](./evidence/execution-docs-relocation-round2-20261007/pre-commit-checks.json)。

[实际命令和结果](./evidence/execution-docs-relocation-round2-20261007/execution-results.json)及同目录 logs 保留原始输出；核验脚本可以从仓库根目录重放。
