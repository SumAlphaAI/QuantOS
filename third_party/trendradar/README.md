# TP09 TrendRadar 参考评估

固定参考提交 `8ee26026ba6c11dec41a95fb3895a7162876caa1`。QuantOS 策略为 reference-only，生产运行时准入 **DENIED**；不克隆、复制、安装或执行上游源码/资产/依赖。

[固定提交官方文档](https://github.com/sansan0/TrendRadar/tree/8ee26026ba6c11dec41a95fb3895a7162876caa1)仅用于功能、GPL-3.0-only 基线与依赖元数据观察。`provenance.json` 保存五个公开文件的 URL、真实 SHA-256、大小、观察时间和文档锚点；没有保存其原始内容。`sbom.spdx.json` 是参考文件元数据清单，不是安装后传递依赖 SBOM，Git commit 不作为 archive SHA256。

`experiments.py` 全部为 QuantOS 自有离线实验。`mappings/` 三份注册合成输入覆盖热榜主题、RSS 主题及缺少许可/来源的降级主题。输入 SHA、独立 JSON Schema、注册表、自有 count/min-rank 统计、质量原因和真实 `quantos.strategy.v1.Signal` protobuf 构造可重放。实验使用固定合成时钟 2026-10-11T00:00:00Z，不宣称当前真实时效。算法不表示上游趋势算法、AI 推断、预测能力或训练模型。所有 Signal 固定为 FLAT、不可交易，StrategyRelease/FeatureSnapshot 引用未解析，不产生交易权限。

```bash
engines/.venv/bin/python third_party/trendradar/experiments.py --output artifacts/tp09-development
node scripts/tp09-evaluation.mjs artifacts/tp09-development
node scripts/tp09-evaluation.mjs --workspace
node scripts/tp09-evaluation.mjs --verify-upstream
engines/.venv/bin/python -m pytest engines/tests/test_tp09_trendradar_mapping_samples.py -vv
node third_party/trendradar/check-development.mjs --record
```

实验生成三份 Signal 文档、六份实体 normalized/lineage 对象及 receipt；EvidenceRef 指向真实对象内容哈希。此实验不注册生产 Artifact 存储或 Signal consumer。许可/来源四组合由质量函数计算；任何组合均不可交易，未注册或真实来源输入在映射之前拒绝。真实热榜/RSS/自定义 API/AI 输出权利均 `NOT_VERIFIED`、准入 `DENIED`；公开软件许可和 URL 可访问性不代替逐来源用途授权。

生产构建入口、build manifest、运行时源码/八份依赖声明与锁文件共同执行排除检查。`--record` 只能出具工程证据，必须完整依赖闭包复评后执行 `--admit` 才能获得 DEVELOPMENT READY；正式 ACCEPTED、托管 CI、发布授权独立。
