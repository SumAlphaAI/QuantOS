# R01 freshness remediation evidence

2026-10-04；仅连接工程配置 Supabase，`QUANTOS_R01_POOL_MODE=transaction`；没有本地数据库、Docker、schema reset、事实删除或远程 push。基线 HEAD 为 e4d2cfdd26f8a7b01838dce7bc1ccff67648d361；回执如实记录 workingTreeModified，最终提交应匹配 sourceHashes，不冒充远程同 SHA CI。

## 尝试与边界

- `target-stable-attempt-01`：源码在运行中变化，FAIL，原测试/覆盖与 actor 只读清理证据保留；不是最终通过。
- `target-stable-attempt-02`、`target-nightly-attempt-01/02`：早期修复版本目标通过；后续停机源码有变化，不能冒充最终原生覆盖。
- `target-nightly-attempt-03`、`target-stable-attempt-03`：停止协议修复阶段的完整八并发及行/分支覆盖；状态以各目录 target-receipt、actor-cleanup 和对应覆盖 Gate 日志为准。
- `supervision-attempt-01/02/03/05/06`：阶段性受控回归通过，源码版本以各自 hashes 为准。
- `supervision-attempt-04/07`：临界 SLA/RPC 耦合导致恢复失败；failure 与原始日志保留，没有作为通过。
- `supervision-attempt-08`：停止协议阶段的 14 项受控回归，包括在途页停止时保留 ACK，异常最大 4385ms。ACK 的最多 5s RPC 确认窗口与 origin→ACK≤5s 验收分开；晚到实际 ACK 如实 FAIL。fixture 与真实来源窗口分别计数。
- `live/attempt-01`：自然告警持久化确认失败，1000.217s，67 点采样；FAIL。只读读回 3648 事实、actor inactive、pending=0；3647 精确 ACK，1 monitor ACK UNKNOWN。完整投递不能覆盖失败。
- `live-retry/attempt-01`：为修复停机/确认问题主动中止，FAIL；只读读回 1262 事实、1260 ACK，2 UNKNOWN，actor inactive。不能累计为 1800 秒通过。

- `target-stable-attempt-04/05`：受限网络连接失败，ownedTenants=[]；保留 failure。`target-stable-attempt-06` 与 `target-nightly-attempt-04`：连接恢复修复阶段的完整八写者与覆盖 Gate PASS，actor 清理读回 PASS。
- `supervision-attempt-09`：当前源码 16 项受控验证 PASS，最大异常 2298ms；包括真实 Supabase 只读查询 3s 延迟、2s 超时后的连接替换与真实 cursor 恢复。
- `live-final/attempt-01`：681.893s，五次连续监控读超时，FAIL；1758/1758 精确 ACK、无缺测，actor inactive；提前退出不作完整窗口通过。
- `live-recovered/attempt-01`：新 actor/空目录、固定 1800s 当前源码真实窗口，已完成 1800s；生命周期 1802.877s 含收尾，120 样本、8530 唯一成交，BOUNDED_INTEGRITY PASS；健康和 ACK 最终结论见独立指标；不自动延长。

## 重放

完整窗口与失败窗口必须分别分析。失败快照始终为 READ_ONLY_FAILED_WINDOW_SNAPSHOT，分析始终 FAIL_WINDOW_PARTIAL_MEASUREMENT。stdout progress、数据库 ingested_at、最终 pending=0 都不能代替 ACK 或五秒判定。

```sh
node scripts/r01-window-metrics.cjs \
  docs/audit/evidence/r01-freshness-remediation-20261004/live/attempt-01 \
  docs/audit/evidence/r01-freshness-remediation-20261004/failed-window-readback \
  /private/tmp/r01-failed-window-new.json --failed-window
node scripts/r01-window-metrics.cjs \
  docs/audit/evidence/r01-freshness-remediation-20261004/live-retry/attempt-01 \
  docs/audit/evidence/r01-freshness-remediation-20261004/interrupted-window-readback \
  /private/tmp/r01-interrupted-window-new.json --failed-window
```

输出文件必须不存在。原始 JSONL 可以无损 gzip，分析器保留逻辑输入原始 SHA 并支持 gzip；压缩前后的结果必须全等。最终 index 和压缩 manifest 提供原始/归档哈希。旧专项报告与旧坏行未修改。

压缩后的覆盖原件可解压到临时文件重验（不得覆盖归档）：

```sh
gzip -dc docs/audit/evidence/r01-freshness-remediation-20261004/target-nightly-attempt-04/coverage.json.gz > /private/tmp/r01-nightly-replay-new.json
node scripts/check-r01-coverage.mjs /private/tmp/r01-nightly-replay-new.json --require-branches
```

`coverage-compression.json` 与 `compression-final.json` 分别保存早期和最终原始/归档 SHA、字节数及无损验证。`source-bindings.json` 是停止修复阶段快照，`source-bindings-final.json` 是最终源文件与回执绑定；不得用早期源码回执替代后续版本。

收尾阶段 `recovered-window-readback` 与 `-02` 的整响应导出环境失败（旧日志未分类错误类型）、`-03` 的排序/翻页不一致造成计数失败均保留；`-04` 使用同一只读一致性快照、完整唯一键及真实数字 sequence 分页，已通过完整 9461 行、9461/9461 ACK 与 inactive actor 校验，最终状态见 target-readback。Clippy 初始夹具未处理读取字节数的失败保留，修正断言后 `clippy-fixed.log` 通过。最终测试源码复验采用 stable attempt-07 与 nightly attempt-05；之前回执仅绑定各自历史源码。

完整窗口离线重放：

```sh
node scripts/r01-window-metrics.cjs \
  docs/audit/evidence/r01-freshness-remediation-20261004/live-recovered/attempt-01 \
  docs/audit/evidence/r01-freshness-remediation-20261004/recovered-window-readback-04 \
  /private/tmp/r01-complete-window-replay-new.json
```

自然异常的五秒判定仅覆盖已观测起点，不能冒充交易所物理断线时刻或未来保证。最终实际新鲜度 DEGRADED；B01、FA-H01 保持 OPEN/PARTIAL。

最终 `source-bindings-final.json` 绑定 33 个文件与 4 份目标/受控/窗口回执；`owned-actors-final-readback-02.json` 独立确认 53 个 owned actor 全部 inactive。当前审批范围和历史失败均保留。
