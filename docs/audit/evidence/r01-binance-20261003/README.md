# R01 Binance 2026-10-03 执行证据

最终有效目录：`verified-stable`、`verified-nightly`（真实 Supabase + loopback 故障注入/全部相关目标测试），`verified-btc`、`verified-eth`（Binance 真实公开 REST、非 fixture）。各 receipt sourceHashes 应与最终 Git 源码 blob 一致；执行时 sourceCommit 是基础 HEAD，dirty=true。真实源另绑定二进制和受控批准文件 hash。

coverage.json.gz 是原始 LLVM JSON 无损压缩；先 `gzip -dc <file> > /private/tmp/r01-binance-coverage.json` 再运行 `node scripts/check-r01-coverage.mjs /private/tmp/r01-binance-coverage.json`；nightly 加 `--require-branches`。全部四个生产文件纳入，COV-R01-01 仅是 cli.rs 的生成声明。

网络探测实际 HTTP 200；真实窗口暂停3s后读取上游参考成交，再重启接续游标，比较T/p/q和完整ID窗口。duplicate-replay.jsonl 是已提交事实的重放输入，trace.jsonl 是共享 trace sink。数据均为公开行情/本次具名测试作用域，无 API Key/数据库凭据。真实脚本自动 cargo build --locked，actor 退出后停用，事实不删除。不能将这些短窗口成功当作正式 SLA/部署或商业许可。

verified-btc/eth 的 checkpoint-readback.json 是后续只读目标查询，绑定各自原 receipt hash，确认两个事件流检查点与最大 sequence 一致、actor 已停用。clock-probe.json 为三次真实 HTTP 时间探测，中点估算不是 NTP/SLA 验收。

其他目录均是历史中间尝试，不计入最终 PASS：

- `legacy-concurrency-failed`：旧8连接并发测试触发共享 pool_size=15；本轮未将该旧用例标为通过。
- `full-r01-target`：旧8线程用例释放闲置客户端后仍触及 pool_size=15；完整 R01 target Gate 失败，不能用专用 Binance target 的 PASS 覆盖该结果。
- `nightly`：新旧测试共用tenant影响processed=4，已拆分作用域。
- `final-nightly`：连接池上限，后续释放测试不用的store并顺序执行。
- `accepted-nightly`：旧CLI目标瞬时失败；`diagnostic-target`补充错误输出后新旧5项目标用例全部通过，再完成 verified 两轮。
- `binance-target`/`real-source`/`final-real-source`：早期成功快照；源码 hash 是当时版本，后续增加页上限与 watchdog 失效停止后，以 verified 为准。

local-gate.log 包含实际编译 mutants；clippy/fmt/event-tests/plans/secrets 是相关最终静态/回归检查，secrets.log 仅 secret-pattern。gitleaks.log 记录本机缺少要求的 Gitleaks 8.28.0，完整扫描 NOT RUN。普通 cargo target gated 显示 NOT RUN 不计数据库通过。未执行远程 CI、长期部署、商业条款审核或完整 SCA/SDK/浏览器套件。
