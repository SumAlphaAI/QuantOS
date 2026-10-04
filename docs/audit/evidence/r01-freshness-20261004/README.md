# R01 新鲜度专项评估证据

基线 commit：a129ca31943d1f0461f89cf726cbdc6bcb958730。报告：[专项评估](../../R01-freshness-assessment-2026-10-04.md)。本次未启动摄取/新 actor，也未执行 24h 或部署；不是新的同 SHA 真实运行/远程 CI 验收。

- `assessment.json`：离线重放结果，输入历史 window 目录的 receipt、index、compression-manifest、samples/supervisor/trace。原 archive 与解压内容 hash 双重检查；坏 trace 仅列行号/字节数/hash，无修补原件。
- `target-attempt-01/target-readback.json`：配置 Supabase 事务池真实 READ ONLY 读回、ROLLBACK；原 actor inactive，无写入。不是本地 fixture 或历史统计推算。
- `target-attempt-01/target-events.json.gz`：11195 条已存在事件的选定时间/身份/质量字段（不导出连接配置或完整业务 payload）。
- `target-attempt-01/target-source-receipts.json.gz`：2329 个已存在 watchdog receipt 身份/时间，用于区分 native/监督 producer；不改写或合并事实。
- `node-tests.log`：分析口径、亚毫秒边界、缺测、损坏 JSONL、输入篡改、actor 生命周期及现有监督/scope 负向测试。均为本地 Node 测试，数据库执行以 target readback 为准。
- `node-tests-development-failure.log.gz`：新增配置失败测试最初误期待通用环境错误；实际正确保留 `R01_DATABASE_CONFIG`，修正测试期望后重跑。原失败日志无损压缩保留，不是 provider 运行失败或数据库写入失败。
- `reproduction-check.log`：离线再生成结果与归档 JSON 全等，以及历史关键源码/批准 hash 不变；不代表同 SHA hosted CI。
- `plan-check.log`：pnpm 包管理器入口因 `@pnpm/exe.darwin-arm64` 缺少 lock 身份而退出 1；`plan-check-direct.log` 是直接执行同一 Node 计划检查的 PASS。未修改依赖/lock 或把入口故障记为通过。
- `diff-check.log`、`gitleaks-raw.log`：空白和 gitleaks 8.28.0 秘密扫描（包括新 gzip 解压内容）。
- `index.json`：本轮最终文件及源码 hashes；不自引用，不改写历史索引。

只读命令：

```bash
QUANTOS_R01_POOL_MODE=transaction node --env-file=.env.local \
  scripts/r01-freshness-readback.cjs docs/audit/evidence/r01-window-20261004 \
  docs/audit/evidence/r01-freshness-20261004/target-attempt-01
```

复核时上面的目录已经有证据，脚本会拒绝复用，必须指定新的空目录；目标连接失败保留 failure，再次尝试采用新的目录，不删除失败记录。离线复现无需数据库：

```bash
node scripts/r01-freshness-assessment.cjs docs/audit/evidence/r01-window-20261004 \
  docs/audit/evidence/r01-freshness-20261004/target-attempt-01 \
  /tmp/r01-freshness-reproduction-new.json

node --test scripts/tests/r01-freshness-assessment.test.cjs \
  scripts/tests/r01-window.test.cjs scripts/tests/binance-supervisor.test.cjs
```

窗口不续期、不扩展，1800 秒/两标的/内部工程用途不变；长期部署、父启动器/主机死亡通知、商用许可、远程同 SHA CI 未验收。B01 OPEN/PARTIAL，完整性 PASS 不等于全程健康。
