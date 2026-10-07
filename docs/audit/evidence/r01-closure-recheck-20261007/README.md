# R01 原十项问题复核证据（2026-10-07）

基线 `68924e1efd6471db6831b666648f3834dc40d140`；本轮只有审计/文档修复，没有改变运行源码。当前结果为原问题 9 CLOSED、B01 PARTIAL/OPEN，专项 FA-H01 独立开放；不是阶段 READY 或正式 ACCEPTED。

## 当前执行

- `make r01-check`：初次 `logs/r01-check.log` 因沙箱禁止回环监听失败；`logs/r01-check-authorized.log` 在允许测试端口的环境退出 0，46 Node、13 market、5 native unit、3 Binance CLI、2 CLI，以及 2 compiled mutants。本地 Rust 的目标用例在显式启用前提前返回，不能据其绿色行宣称数据库通过。
- `QUANTOS_R01_POOL_MODE=transaction QUANTOS_R01_EVIDENCE_DIR=docs/audit/evidence/r01-closure-recheck-20261007/target-functional node --env-file=.env.local scripts/r01-live-check.cjs`：退出 0。同一配置 Supabase 项目事务池；runner 6 项（其中包含 CLI 配置拒绝等非数据库检查），真正数据库断言包括八独立写者、原子回滚重试、重启/冲突、页游标/断线恢复、watchdog、死信/交付和 RLS/不可变回执。25 receipts、30 events、30 outbox；4 个具名 actor 均 inactive。没有 reset、删除事实或调用真实 provider。
- `cargo fmt --all -- --check` 与 `cargo clippy -p quantos-market -p market-ingestor --all-targets --locked -- -D warnings`：退出 0。
- `node scripts/with-pinned-toolchain.cjs make development-plan-check`：结构和 38 项负向检查通过；不替代平台加载/模型评审或阶段输入有效性。
- 文档链接、归档 SHA、Runbook shell 语法、当前 sourceHash、原问题数量与状态、证据凭据泄露检查分别记录；凭据检查仅输出命中标签/状态，不打印值。

## 历史证据复用

`historical-integrity.json` 验证专项历史索引的 412 个文件哈希，33 份源文件绑定中 28 个仍匹配。差异为 Cargo.lock、Makefile、package.json、pnpm-lock.yaml、监督验证器；不能把旧依赖环境/整个运行包认作当前同 SHA。

`historical-window-replay.json` 是当前分析器对旧完整窗口及旧目标只读快照的离线复算，和旧 final-window-metrics.json 完全相同。没有新 DB 导出或真实源采集。命令：

```sh
node scripts/r01-window-metrics.cjs \
  docs/audit/evidence/r01-freshness-remediation-20261004/live-recovered/attempt-01 \
  docs/audit/evidence/r01-freshness-remediation-20261004/recovered-window-readback-04 \
  /private/tmp/r01-historical-replay-new.json
```

输出文件必须尚不存在。历史 stable attempt-07、nightly attempt-05 的 coverage.json.gz 解压到一次性临时文件，以 `check-r01-coverage.mjs`（nightly 加 `--require-branches`）重算通过，见两个 historical coverage 日志。本轮没有重新采集覆盖或执行 16 项监督故障，相关结果明确标为历史，不冒充当前目标验收。

初审原文完整保存为 `docs/audit/R01-initial-review-2026-10-02.md`，归档回执记录原路径/SHA 和历史链接迁移。原先的 10/10 缺陷复现探针、所有失败及源数据均未删除。本轮新增证据目录不复用过去运行目录。
