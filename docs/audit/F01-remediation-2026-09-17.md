# F01 整改与验证记录

> 2026-09-17；对应 [初审报告](./F01-comprehensive-review-2026-09-17.md)。初审是历史快照，本文件记录后续整改。

## 实现整改

- A02：独立 Git archive 源码副本；拒绝脏工作区和少于三次；自动枚举 7 个 Rust binary、8 个 wheel、7 个 Web/package 输出；双向检查产物清单，失败撤销旧成功回执。
- A03/A04/A06：uv 版本预检；锁定 Hatchling 及完整构建依赖闭包；Cargo/uv/pnpm manifest 一致性与 Buf lock 结构检查。
- A05/A10：补齐 auth、policy、BFF README；服务目录索引与实际成员核对，45/45 模块根文档检查。
- A07：一期 pnpm workspace 明确包含 website、terminal、packages；Desktop 采用独立 workspace/lock 与手动 CI。
- A08：Terminal 默认 lint 覆盖 app/src/tests 的 TS/TSX。
- A09：通过 [ADR](../adr/20260917-f01-rust-test-runner.md) 正式采用固定 Rust 工具链下的 cargo test，保留集成测试和 doctest，无删减用例。
- A01：新增带 source commit/tree、平台、工具链、计时、命令退出码和逐文件 digest 的验收器；等待干净提交后的真实运行回执。

## 本地验证

`make lockfile-check f01-check lint test` 分批通过。15 个负向/隔离测试通过：产物变化与缺失、额外产物、空输出、目录清单漂移、脏/未跟踪输入、README 删除、uv 漂移、无效锁、三语言 manifest 漂移、Buf 无效锁、TSX lint 注入、旧回执失效、Desktop 损坏隔离。Python 91 项、一期 TypeScript 115 项通过；Rust 工作区通过（无凭据提前返回的测试不是目标数据库验收）。

初始新增审计探针存在 Ruff 格式问题，已格式化并复验。生产凭据与真实业务环境未使用。

## 正式验收

执行顺序：提交实现以建立不可变 SHA；在该干净提交运行 clean-room 与三次构建；最后提交回执和最终状态文档。验收器清除环境凭据并禁用 `.env` 加载。

状态：PENDING。远程 GitHub CI、真实数据库与浏览器矩阵未在本任务声称通过。
