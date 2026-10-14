# TP01 Vibe Adapter Canary Rollback

TP01-F 本地控制仅适用于 TEST/RESEARCH：签名研究 catalog、UDS 合成请求和内存 mock Artifact。7 天真实 canary、目标回滚≤300秒、生产签名 authority、业务控制授权、持久审计与监控部署由测试及 RELEASE-GATE:BETA 独立验收。

## 实际本机控制

服务默认禁止 Execute/StreamExecute。宿主创建 `RolloutController(policy, authority_key)`，经 `activate_canary(candidate=(bytes, descriptor, signature), previous=(bytes, descriptor, signature))` 同时验证两套实际制品、release ID 与 policy digest。descriptor schema 为 `quantos-vibe-local-release/v1`，scope 固定 `LOCAL_RESEARCH_ONLY`；HMAC key 由宿主提供，不从候选/request 获取。公开 fixture authority 只能用于演练，不能形成生产回执。`signedArtifactsPresent=true` 或普通 SHA256 旁文件均不能替代此验签。

服务构造为 `VibeAdapterService(rollout=controller)`。只按策略 5% 稳定分流；未选中请求返回 UNAVAILABLE，宿主负责既有路由回退。影子服务必须由宿主单独构造 `shadow_mode=True`，具有独立 facade/bucket；请求负载无此权限。`--fixture-routing` 仅供原 unsigned 本地契约回归，环境仍限制 TEST，不是可部署发布路径。

宿主对运行中的同一 controller 执行一键控制：

```python
controller.disable("critical canary alert")
controller.rollback("restore verified previous research artifact")
```

动作递增 epoch，立即阻止旧工作在 Artifact 提交时写入；已提交的确定性结果仍有效，已提交 stream 允许完成。动作先发生的 unary/stream 返回 CANCELLED / ENGINE_ROLLOUT_REVOKED；新请求在 disabled 状态被拒绝。rollback 从已验签、固定到内存的 previous provider 实际恢复协议数据，不再读取可变制品文件；候选流量降至 0。原 idempotency key 不能悄悄改绑不同制品。再次激活不恢复旧 epoch 权限。

`controller.observe(samples)` 对完整有限样本触发阈值规则，critical 执行 disable，warning 继续观测。`snapshot()` 保存序号、epoch、动作、request/reason hash、制品摘要、签名拒绝和影子计数。该 API 由宿主可信控制面调用；本次未实现或批准远程控制 API、跨进程状态及生产业务权限。

## 可重复本地演练

从 QuantOS 根目录使用当前工程解释器，选择不存在的新输出目录：

```bash
engines/.venv/bin/python -m vibe_adapter.local_drill \
  --output-dir /tmp/quantos-tp01-f-fresh-drill \
  --policy third_party/vibe-trading/canary-policy.json \
  --catalog engines/vibe-adapter/src/vibe_adapter/fixtures/catalog.json
```

该独立进程启动两个本机 UDS 服务，执行 19 条演练并保存候选/previous 字节、签名 descriptor、drill 与连续事件；公开 fixture authority 不从生产环境读取。原目录不可覆盖。演练不推进真实 canary 天数，不接受性能 SLA，不签发 release/候选采用权限。

完整功能入口为 `node scripts/tp01-f-functional.mjs --record`；阶段准入由 `make tp01-f-local-check` 验证 29 节点同候选完整证明。`make tp01-f-release-check` 在目标/正式验收不足时必须拒绝。dashboard/alert rules 文件仍是配置；`runtimeMetricExport=false`，本地事件快照不冒称部署后的遥测。

## 原离线模拟脚本

`tp01-vibe-canary.mjs`、`tp01-vibe-rollback.mjs` 保留合成指标评估和 JSON 状态投影；其 `evidenceMode=SYNTHETIC_POLICY_SIMULATION`、`formalAccepted=false`。`healthy-7d` 和 `rollbackCompletedSecs=240` 是 fixture 字段。修改 `rollout-state.json` 不会改变运行中的 Python controller；一键真实本机控制采用上文宿主 API。`sign-artifacts.sh` 在无 key 时只是 integrity-only，不能被当作 rollout authority 签名或生产信任。

```bash
node scripts/tp01-vibe-rollback.mjs \
  --state /tmp/local-simulation/rollout-state.json \
  --action disable --reason "synthetic drill" \
  --output-state /tmp/local-simulation/disabled.json \
  --output-report /tmp/local-simulation/disable-report.md
```

模拟动作保留原阻断/告警，不用 disable/rollback 清除事故。实际 7 天无未解释 P1、目标环境≤5分钟回滚及 audit 完整签名必须另行绑定真实候选、环境和授权，未执行记 NOT_RUN。
