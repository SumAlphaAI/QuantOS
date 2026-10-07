# 执行文档目录整理复核（2026-10-07）

迁移前源码：`375019f964f375f9767b4d03a85523a141fa3f0d`。范围为 `docs/` 根目录以 BFF-FE、DESK-PRE、PRE-01–PRE-06 开头的 25 份文档。

## 用途判断与处置

25 份全部保留并迁入 `docs/execution/`，删除 0 份。它们包含仍由门禁读取的需求/设计/接口规则 JSON 基线与台账、页面和权限需求、Desktop 二期独有需求承接、环境/服务运行指南，以及可追溯既有交付和未完成边界的历史摘要。历史摘要引用较少也不能据此认定无用。

[逐文件用途索引](../execution/README.md)列出每份保留理由；[引用盘点](./evidence/execution-docs-relocation-20261007/reference-analysis.json)区分活动消费者与历史记录，[迁移映射](./evidence/execution-docs-relocation-20261007/migration-map.json)保存逐文件旧/新路径及 SHA-256。

## 同步与保留边界

当前三份计划、文档索引、设计 ADR、PRE/BFF 检查脚本、G0/A1 输入策略、字段字典生成器及 E2E 来源注释同步新路径。三份 JSON 基线保留原始字节；Markdown 仅调整迁移所需相对链接及路径文字，业务正文不删除。

历史审计、内容绑定回执、用户确认原件和秘密扫描忽略记录不改字节。历史记录中的旧路径属于当时输入；通过迁移映射或 execution 索引定位现行同名文档，原版本可从迁移前 Git 提交读取。可变的当前 G0 确认指针/状态改为 PENDING，当前遗留处置 JSON 的活动场景引用同步新路径；三者原件另存本轮证据目录。

## 阶段准入

输入路径、被哈希读取的脚本和策略发生变化，原 26 个 READY 及 G0 范围 `52fee5f6e499` 均为迁移前记录。[旧阶段/依赖快照](./evidence/execution-docs-relocation-20261007/previous-admission.json)和[旧确认状态](./evidence/execution-docs-relocation-20261007/previous-g0-confirmations.json)保留。当前这 26 项清为 NOT_ASSESSED，159 个节点均无继承的 READY；开发完成和历史正式验收字段不迁移。

本次只核验目录整理及相关静态/本地回归。未执行新一轮 Supabase 功能复评、全量 87 组工程检查、hosted CI 或 RELEASE 验收；当前功能 READY 需独立复评及适用的新范围确认。

## 验证

- [迁移核验](./evidence/execution-docs-relocation-20261007/relocation-verification.json)：363 项通过，25 个文件全部到位，三份 JSON 字节未变；业务正文与重定位链接核验、7952 份历史文件保留、开发字段/正式检查点保留、字段字典生成无漂移。
- 计划联合检查通过：47 个核心任务、75 个前端任务、159 个准入节点、37 个检查点和 1462 条依赖，结构与顺序 PASS；READY 0、NOT_ASSESSED 159。
- PRE-01/02/04、BFF 契约覆盖及 BFF-FE-000/001/007 本地检查通过。315 项门禁回归和 27 项设计负向通过；BFF-FE-001 的本地 provider/consumer 语义实际执行通过。
- 初次回归发现当前 G0 遗留处置 JSON 的场景证据仍用旧路径，修复后 315/315 通过，原失败日志保留。
- 直接 ESLint 为 FAIL（39 条既有脚本诊断）。[与迁移前逐条比较](./evidence/execution-docs-relocation-20261007/lint-baseline-comparison.json)相同，新增诊断 0；不把直接 lint 记为 PASS。
- [旧准入拒绝探针](./evidence/execution-docs-relocation-20261007/stale-admission-rejection.json)：A1、A2、G0、FEP-0 严格入口均拒绝旧准入，4/4 符合预期。

[命令与结果](./evidence/execution-docs-relocation-20261007/execution-results.json)及同目录 logs 保存成功和失败原始输出。[提交前核验](./evidence/execution-docs-relocation-20261007/pre-commit-checks.json)：变更/新增文件秘密扫描无泄露，diff whitespace PASS；未执行项目不记为通过。
