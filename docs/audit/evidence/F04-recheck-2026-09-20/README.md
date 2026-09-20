# F04 本地复验回执（2026-09-20）

基线：`b20aca4e74e29c7606ae6eb6f243806ecfe8cc19` 加本目录所在提交的修复。回执来自 macOS 本地工作树，不是 GitHub 同 SHA 回执。

| 验证 | 退出码 | 原始回执 |
|---|---:|---|
| `make f04-check` | 0 | [日志](f04-check.log) |
| `make coverage-rust-branch` | 0 | [日志](branch.log)、[LLVM 摘要](branch-summary.json) |
| `cargo fmt --all -- --check` | 0 | 无输出 |
| `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` | 0 | [日志](clippy.log) |
| `cargo test --workspace --locked` | 0 | [日志](workspace-test.log) |

分支覆盖率使用 `RUSTUP_TOOLCHAIN=nightly`，rustc 为 `1.94.0-nightly (24139cf84 2025-12-20)`；`LLVM_COV`、`LLVM_PROFDATA` 指向本机 Rust 1.91.0 的 LLVM reporting 工具。远端 workflow 安装 nightly 对应 llvm-tools-preview；远端结果仍待人工推送后收集。

稳定版独立 core line 97.74%、region 96.73%；nightly branch 43/44（97.73%），precision 11/12（91.67%）。clock 无可计数分支，line/region 100%，另有时区行为测试。双进程各 1,000 样本摘要一致，最大 P95 31μs。新增整数及十进制边界 corpus 改变测试摘要，不改变生产 hash 算法。

验收脚本负向测试覆盖缺失/非数字/非有限/负值/超时 P95、样本数错误、摘要不一致、空/低/伪造分支数据及 precision 单模块覆盖率不足。
