# R01 整改证据

`index.json` 绑定最终 8 个生产/测试源码 hash；stable 与 nightly receipt 各自记录执行时 Git HEAD 和 dirty=true。期间另一个 PRE-01 任务提交了独立变更，HEAD 已从审计基线前进；hash 核对证明两轮目标验证针对最终 R01 源码，不把 dirty receipt 伪称远程 exact-SHA 验收。

- `accepted-stable/`、`final-nightly/`：最终目标测试日志、owned fixture UUID、结构化 receipt、逐文件 coverage summary；raw LLVM JSON 以 `coverage.json.gz` 无损压缩保存。可 `gzip -dc coverage.json.gz > /private/tmp/r01-coverage.json` 后运行 `node scripts/check-r01-coverage.mjs /private/tmp/r01-coverage.json`；nightly 加 `--require-branches`。stable 分支未采集，count=0 不代表失败或通过。
- `local-gate-final.log`：13 Rust unit、CLI 成功/拒绝、16 JS 负向及两个实际编译/执行 mutants。无数据库变量时 CLI target 显示 NOT RUN，不能代替上面实际 Supabase 测试。
- `workspace-tests-authorized.log`：全 Rust workspace、Python runtime UDS 与 doctest；UDS 在文件/套接字沙箱下受限，授权执行后通过。数据库 gated 用例仍仅在目标 Gate 执行。
- `workspace-clippy-final.log`、`fmt-final.log`、`plans-final.log`、`secrets-final.log`、`locks-final.log`：最终对应检查。锁检查使用已有 Corepack pnpm 与临时 UV cache；非致命更新 DNS 提示不记联网元数据检查通过。
- `migration-apply.log`/`migration-apply-final.log`：实际 Supabase 向前应用三份 R01 migration，不 reset。
- `target-first-failed.log`/`target-second-failed.log`：早期性能/F05 fixture 假设失败的追溯记录，不作为最终 PASS；重复中间覆盖资产已移除。初始多 SQL roundtrip 超过5s，最终单 SQL 原子写入通过；最终 F05 每事件 inbox/outbox 双死信正确计数。

真实 provider URL/批准记录、native adapter、部署采集、远程 workflow receipt 均未提供或执行。数据库/loopback HTTP 测试都是 fixture，不证明真实供应商验收。本次只新增 owned fixture，不删除不可变事实，结束时停用本次 actor。
